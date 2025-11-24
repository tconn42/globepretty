//////////////////////////////////////////////////////////////////////////////
// 
// Extends the Globe class (github.com/vasturiano/globe.gl).
//
// The Globe class visualizes point, arc, ripple, tile, and other elements
// on a globe. 
//
// This adds the functions:
//   setTime(currtime):
//     Sets the current time to the given integer.
//   getTime(): 
//     Retrieves the current integer time.
//   setTimeListener(cbfn):
//     Specifies a callback function to invoke with the current integer
//     time whenever it changes. This function is invoked prior to calling
//     tick() on elements (q.v.)
//   play(durationms, starttime, endtime):
//     Begins playback from the current time and progresses linearly to the
//     specified endtime. The speed is calculated to take durationms if
//     playing from starttime to endtime. This function returns a handle,
//     which is a record of the following functions:
//       pause(), resume(), isPlaying(), and rewind()
//     Note that it is ok to call setTime() during playback. If you do, it
//     simply seeks to that time and continues playing from there.
//
// This also allows point, arc, ripple, tile, and other elements to include
// a property function:
//   tick(element, currtime):
//     This function is called with the element and the current time
//     whenever the current time changes. The tick() function can 
//     position/style the element according to the current time or even
//     remove it from display (by returning false).  
//
// This also adds the following UI options to the constructor/prototype's
// opts argument:
//   showTime: a function that takes the current time and formats it for
//             display. If given, the current time is displayed.
//             Class to style: globewhen_timelabel
//   showPlay: { durationms: , starttime: , endtime: } which displays a
//             play/pause button, which when clicked, advances the current
//             time from its current value to endtime at a rate that would
//             advance it from starttime to endtime over durationms.
//             Class to style: globewhen_timeplay
//   showSlider: { starttime: , endtime: } which shows a slider that allows
//               the user to set the current time between starttime and
//               endtime.
//               Class to style: globewhen_timeslider
//
//////////////////////////////////////////////////////////////////////////////

const OrigGlobe = Globe;

Globe = function(container, opts)
{
  let _three;

  // Planet details
  const _planet =
  {
    earth:
    {
      radius: 6371, // in miles
      atmosphere: true,

      // Originally at http://unpkg.com/three-globe/example/img/earth-blue-marble.jpg
      imageURL: 'images/earth-blue-marble.jpg',

      // Originally at http://unpkg.com/three-globe/example/img/earth-blue-marble.jpg
      nightImageURL: 'images/earth-night.jpg',

      // Originally at http://unpkg.com/three-globe/example/img/earth-topology.png
      bumpImageURL: 'images/earth-topology.png',

      // How much to exaggerate the bump map
      bumpScale: 10,

      // Altitude to show clouds
      cloudsAltitude: 0.015,

      // How fast to rotate the clouds in deg/frame
      cloudsRotateSpeed: 0.006,

      // The url of the clouds
      cloudsURL: 'images/clouds.png'
    },

    moon:
    {
      radius: 1080,
      atmosphere: false,

      imageURL: 'images/lunar_surface.jpg',
      bumpImageURL: 'images/lunar_bumpmap.jpg',
      bumpScale: 1
    }
  };

  // Add defaults
  opts = { 
           // Spins the globe at the given speed. Negative speed spins backward.
           // Zero speed stops it.
           autoRotateSpeed: 0.35,

           // Zero to never stop spinning. Else stop spinning on interaction.
           autoSpinAfterIdleMs: 15000,

           // How much the value needs to change to be considered an interaction
           // that stops the globe rotation
           interactionSpinThreshold: .01,

           // When zoomed in to greater than this altitude, do not spin the globe
           onlySpinAboveAltitude: .4,

           // Whether to show clouds
           showClouds: true,

           // Whether to show slippy tiles for infinite zoom
           tileEngineURL: 'https://tile.openstreetmap.org/${l}/${x}/${y}.png',

           // The altitude at which to place the planet surface image so that it
           // appears above the slippy tiles (if present) and below the clouds
           surfaceAltitude: 0.01,

           // Specify the planet to use: earth or moon
           planet: 'earth',

           // Specify one of 'day', 'night', or 'daynight' (which blends day/night
           // images according to where the sun is right now)
           dayMode: 'day',

           // The url of the background stars
           starsURL: 'images/night-sky.png',

           // Whether to increase performance at the expense of precision
           maxPerformance: false,

           ...opts };

  if (opts.maxPerformance)
    opts.rendererConfig = { antialias: false, alpha: false, precision: 'lowp' };

  const g = new OrigGlobe(container, opts);

  // Apply tile server if given
  if (opts.tileEngineURL)
  {
    g.globeTileEngineUrl((x, y, l) => opts.tileEngineURL.replace('${x}', x)
                                                        .replace('${y}', y)
                                                        .replace('${l}', l));
  }


  const planet = _planet[opts.planet];
 
  // If there's no night image for this planet, we must use day mode
  if (!planet.nightImageURL)
    opts.dayMode = 'day';

  // Apply images
  if (!opts.tileEngineURL && planet?.imageURL)
    g.globeImageUrl(opts.dayMode === 'night' ? planet.nightImageURL : planet.imageURL);
  if (!opts.tileEngineURL && planet?.bumpImageURL)
    g.bumpImageUrl(planet.bumpImageURL);
  if (opts.starsURL)
    g.backgroundImageUrl(opts.starsURL);
  if (planet?.atmosphere)
    g.showAtmosphere(planet.atmosphere);

  ///////////////////////////////////////////////////////////////////////////
  // GLOBE READY OVERRIDE
  ///////////////////////////////////////////////////////////////////////////
  let _globeReadyCbfn;
  let _globeready = false;

  g.onGlobeReady(async () =>
  {
    // Auto-rotate the globe if requested
    g.spinGlobe(opts.autoRotateSpeed);

    if (opts.tileEngineURL)
      await _showSurface();
    if (opts.showClouds)
      await g.showClouds(true);

    if (_globeReadyCbfn)
      _globeReadyCbfn();

    setTimeout(() => _globeready = true, 1);
  });

  g.onGlobeReady = function(cbfn)
  {
    _globeReadyCbfn = cbfn;
    return g;
  };

  ///////////////////////////////////////////////////////////////////////////
  // INTERACTIONS
  ///////////////////////////////////////////////////////////////////////////

  let _nonInteractionTimer;

  let _onInteraction = function()
  {
    // Do nothing if globe isn't ready yet
    if (!_globeready)
      return;

    // Wait to start the globe spinning if so instructed
    if (opts.autoSpinAfterIdleMs > 0)
    {
      g.spinGlobe(0);
      if (_nonInteractionTimer)
        clearTimeout(_nonInteractionTimer);
      _nonInteractionTimer = setTimeout(() =>
      {
        _nonInteractionTimer = null;

        // If we are too zoomed in, don't spin
        const latlngalt = g.pointOfView();
        if (latlngalt.altitude > opts.onlySpinAboveAltitude)
          g.spinGlobe();
      }, opts.autoSpinAfterIdleMs);
    }
  }

  // Override zoom so we catch interactions that stop the globe spin and so
  // we can change the surface opacity if applicable
  let _onZoomCbfn;
  let _prevLatLngAlt;
  g.onZoom(latLngAlt =>
  {
    // We only count altitude changes as an interaction
    if (_prevLatLngAlt?.altitude != null &&
        Math.abs(_prevLatLngAlt.altitude - latLngAlt.altitude) > opts.interactionSpinThreshold)  
      _onInteraction();

    // Handle surface opacity
    if (Math.abs(_prevLatLngAlt?.altitude - latLngAlt.altitude) > .00001)
      _changeSurfaceOpacity(latLngAlt.altitude);

    // Handle day/night shading
    if (_prevLatLngAlt?.lat != latLngAlt.lat || _prevLatLngAlt?.lng != latLngAlt.lng)
      _updateSunRotation(latLngAlt);

    _prevLatLngAlt = latLngAlt;

    if (_onZoomCbfn)
      _onZoomCbfn();
  });
  g.onZoom = function(cbfn)
  {
    _onZoomCbfn = cbfn;
    return g;
  };

  // Override clicks so we catch interactions that stop the globe spin
  const _onClickCbfn = {};
  ['Globe', 'Point', 'Arc', 'Polygon', 'Path', 'Heatmap', 'Hex',
   'HexPolygon', 'Tile', 'Particle', 'Label', 'Object', 'CustomLayer'].forEach(el =>
  {
    g['on' + el + 'Click']((...args) =>
    {
      _onInteraction();
      if (_onClickCbfn[el])
        _onClickCbfn[el](...args);
    });
    g['on' + el + 'Click'] = function(cbfn)
    {
      _onClickCbfn[el] = cbfn;
      return g;
    };
  });

  ///////////////////////////////////////////////////////////////////////////
  // SPIN GLOBE
  ///////////////////////////////////////////////////////////////////////////

  let _spinspeed;

  // Spins the globe at the given speed. If speed is null/undefined, resume
  // previous speed. Negative speed spins backward. Zero speed stops it.
  g.spinGlobe = function(speed)
  {
    if (speed == null)
      _spinspeed = _spinspeed || opts.autoRotateSpeed;
    else if (speed)
      _spinspeed = speed;
    g.controls().autoRotate = speed === 0 ? false : true;
    g.controls().autoRotateSpeed = _spinspeed;
  }

  ///////////////////////////////////////////////////////////////////////////
  // REALISTIC SURFACE OVERLAY
  ///////////////////////////////////////////////////////////////////////////

  // Show or hide the surface overlay
  let _surface, _solar;
  const _showSurface = async function()
  {
    if (!_three)
    {
      // We dont want three.js to complain that it was brought in again
      // after being brought in by global.gl, but we have to bring it in
      // again, because global.gl doesnt expose it. Here we just delete
      // the flag that three.js uses to detect that it was already loaded.
      delete window.__THREE__;

      _three = await import('../js/three.core.mjs');
    }

    _solar = opts.dayMode === 'daynight'
               ? await import('../js/solar-calculator.mjs')
               : null;

    const planetimage = opts.dayMode === 'night' ? planet.nightImageURL : planet.imageURL;

    const surfaceTexture = await new _three.TextureLoader().loadAsync(planetimage);
    const bumpTexture = await new _three.TextureLoader().loadAsync(planet.bumpImageURL);
    const surface2Texture = opts.dayMode === 'daynight' 
                              ? await new _three.TextureLoader().loadAsync(planet.nightImageURL)
                              : null;

    const matopts = opts.dayMode === 'night' 
                     ? { color: 0x000000, emissive: 0xffffff, emissiveMap: surfaceTexture }
                     : { };
    const mat = opts.dayMode === 'daynight'
                  ? _createDayNightMaterial(surfaceTexture, surface2Texture)
                  : new _three.MeshLambertMaterial({ ...matopts, map: surfaceTexture, 
                                                     transparent: true, bumpMap: bumpTexture,
                                                     bumpScale: planet.bumpScale });
    const widthSegments = Math.max(4, Math.round(360 / g.globeCurvatureResolution()));
    const geo = new _three.SphereGeometry(g.getGlobeRadius() * (1 + opts.surfaceAltitude), 
                                          widthSegments, widthSegments/2);
    _surface = new _three.Mesh(geo, mat);

    // Set sun position
    if (opts.dayMode === 'daynight')
      _moveSunToPositionAtDate();

    // Add the surface to the scene
    g.scene().add(_surface);
  }

  const _changeSurfaceOpacity = function(altitude)
  {
    if (!_surface)
      return;

    const opacity1alt = 1;
    const opacity0alt = .4;

    const opacity = Math.min(1, Math.max(0, (altitude - opacity0alt) / (opacity1alt - opacity0alt)));

    if (_solar)
      _surface.material.uniforms.opacity.value = opacity;
    else
      _surface.material.opacity = opacity;
  };

  // Get position of sun at given dt
  const _sunPosAt = function(_solar, dt)
  {
    const day = new Date(+dt).setUTCHours(0, 0, 0, 0);
    const t = _solar.century(dt);
    const lng = (day - dt) / 864e5 * 360 - 180;
    return [lng - _solar.equationOfTime(t) / 4, _solar.declination(t)];
  };

  const _moveSunToPositionAtDate = function(dt = new Date())
  {
    if (_solar && _surface)
      _surface.material.uniforms.sunPosition.value.set(..._sunPosAt(_solar, dt));
  };

  const _updateSunRotation = function(latLngAlt)
  {
    if (_solar && _surface)
      _surface.material.uniforms.globeRotation.value.set(latLngAlt.lng, latLngAlt.lat);
  };

  // Create day/night shader
  const _createDayNightMaterial = function(daytexture, nighttexture)
  {
    const vertexShader = `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const fragmentShader = `
        #define PI 3.141592653589793
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec2 sunPosition;
        uniform vec2 globeRotation;
        uniform float opacity;
        varying vec3 vNormal;
        varying vec2 vUv;

        float toRad(in float a) {
          return a * PI / 180.0;
        }

        vec3 Polar2Cartesian(in vec2 c) { // [lng, lat]
          float theta = toRad(90.0 - c.x);
          float phi = toRad(90.0 - c.y);
          return vec3( // x,y,z
            sin(phi) * cos(theta),
            cos(phi),
            sin(phi) * sin(theta)
          );
        }

        void main() {
          float invLon = toRad(globeRotation.x);
          float invLat = -toRad(globeRotation.y);
          mat3 rotX = mat3(
            1, 0, 0,
            0, cos(invLat), -sin(invLat),
            0, sin(invLat), cos(invLat)
          );
          mat3 rotY = mat3(
            cos(invLon), 0, sin(invLon),
            0, 1, 0,
            -sin(invLon), 0, cos(invLon)
          );
          vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
          float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv);
          float blendFactor = smoothstep(-0.1, 0.1, intensity);
          gl_FragColor = mix(nightColor, dayColor, blendFactor);
          gl_FragColor.a = opacity;
        }
    `;

    return new _three.ShaderMaterial({
        uniforms: {
          dayTexture: { value: daytexture },
          nightTexture: { value: nighttexture },
          sunPosition: { value: new _three.Vector2() },
          globeRotation: { value: new _three.Vector2() },
          opacity: { value: 1.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true
      });
  };

  ///////////////////////////////////////////////////////////////////////////
  // CLOUDS
  ///////////////////////////////////////////////////////////////////////////

  // Show or hide the clouds
  let _cloudsshown = false;
  let _clouds;
  g.showClouds = async function(show)
  {
    // Do nothing if already in the desired show state
    if (show === _cloudsshown || !planet?.cloudsURL)
      return;

    _cloudsshown = show;

    // If showing, create them
    if (show)
    {
      if (!_clouds)
        await _createClouds();
      else
        _addClouds();
    }

    // Otherwise remove the clouds
    else
      g.scene().remove(_clouds);
  }

  const _createClouds = async function()
  {
    if (!_three)
    {
      // We dont want three.js to complain that it was brought in again
      // after being brought in by global.gl, but we have to bring it in
      // again, because global.gl doesnt expose it. Here we just delete
      // the flag that three.js uses to detect that it was already loaded.
      delete window.__THREE__;

      _three = await import('../js/three.core.mjs');
    }

    return new Promise(resolve =>
    {
      // Create the clouds texture
      new _three.TextureLoader().load(planet.cloudsURL, cloudsTexture => 
      {
        const widthSegments = Math.max(4, Math.round(360 / g.globeCurvatureResolution()));

        _clouds = new _three.Mesh(
          new _three.SphereGeometry(g.getGlobeRadius() * (1 + planet.cloudsAltitude), 
                                    widthSegments, widthSegments/2),
          new _three.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
        );

        // Clouds are a bit clearer at night
        if (opts.dayMode === 'night')
          _clouds.material.opacity = .4;

        _addClouds();
        resolve();
      });
    });
  };

  // Function for adding the clouds once they are loaded
  const _addClouds = function()
  {
    // Add the clouds to the scene
    g.scene().add(_clouds);

    // Permanently rotate the clouds
    function rotateClouds() 
    {
      _clouds.rotation.y += planet.cloudsRotateSpeed * Math.PI / 180;
      if (_cloudsshown)
        requestAnimationFrame(rotateClouds);
     }
    rotateClouds();
  };

  ///////////////////////////////////////////////////////////////////////////
  // RESIZING
  ///////////////////////////////////////////////////////////////////////////

  // Handle window/container resizing
  window.addEventListener('resize', () =>
  {
    g.width(container.offsetWidth)
     .height(container.offsetHeight);
  });

  return g;
}

