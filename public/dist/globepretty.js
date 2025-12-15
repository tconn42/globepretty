//////////////////////////////////////////////////////////////////////////////
// 
// Extends the Globe class (github.com/vasturiano/globe.gl).
//
// The Globe class visualizes point, arc, ripple, tile, and other elements
// on a globe. 
//
// This adds the following options to the opts parameter of the Globe
// constructor:
//
//   autoRotateSpeed (default 0.35)
//     Spins the globe at the given speed. Negative speed spins backward.
//     Zero speed stops it. User interactions stop it temporarily.
//     Note that spin can also be started and stopped with the new member
//     function spinGlobe(speed).
//
//   interactionSpinThreshold (default .01)
//     How much the user needs to change the altitude value before the
//     interaction temporarily stops the globe rotation
//
//   autoSpinAfterIdleMs (default 15000)
//     How long to wait after a user interaction before resuming the spin.
//     Zero to never stop spinning
//
//   onlySpinAboveAltitude (default .4)
//     When zoomed in to greater than this altitude, stop spinning the globe
//
//   showClouds (default true)
//     Whether to show clouds.
//     Note that clouds can also be shown or hidden with the new member
//     function showClouds(bool).
//
//   tileEngineURL (default 'https://tile.openstreetmap.org/${l}/${x}/${y}.png')
//     Where to fetch slippy map tiles. If null, when zooming into the globe,
//     the surface image gets grainier and grainier. If supplied, the surface
//     shifts from fully opaque at altitude 1 to fully transparent at altitude
//     .4, revealing the slippy map tiles underneath. This provides a nice
//     effect for zooming from a blue marble image to a useable map.
//
//   surfaceAltitude (default 0.01)
//     The altitude at which to place the planet surface image so that it
//     appears above the slippy tiles (if present) and below the clouds
//
//   planet (default 'earth')
//     Specify the planet to use: 'earth', 'moon', 'mercury', 'venus',
//     'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'sun', or a
//     record of the form:
//     {
//       radius: int,             // Planet's radius in miles
//       imageURL: str,           // URL of day time image of the planet
//       // Below are optional:
//       atmosphere: bool,        // Whether to render an atmosphere glow
//       nightImageURL: str       // URL of night time image of the planet
//       bumpImageURL: str        // URL of bump map image for the planet
//       bumpScale: int,          // How much to exaggerate the bump map
//       cloudsAltitude: float    // Altitude to show clouds
//       cloudsRotateSpeed: float // How fast to rotate clouds in deg/frame
//       cloudsURL: str           // URL of image to use as clouds
//     }
//
//   dayMode (default 'day')
//     One of 'day' (which renders the planet's day image), 'night' (which
//     renders the planet's night image), or 'daynight' (which blends the
//     day and night images together based on where the sun is right now and
//     accurately updates it once every minute).
//
//   starsURL (default 'images/night-sky.png')
//     The url of the background stars, used to fill the container's background.
//
//   receiveShadows (default false)
//     Whether the surface should receive cast shadows
//
//   maxPerformance (default false)
//     Whether to increase performance at the expense of precision. If true,
//     sets rendererConfig to:
//       { antialias: false, alpha: false, precision: 'lowp' }
//
// To provide a familiar view, the globe is initially set to show the user's
// location, which is derived solely from the local timezone.
// 
// Resizing the globe's container automatically recenters/resizes the globe.
//
// To use this module, import it after importing globe.gl, like this:
//     <script language="javascript" src="globe.gl.min.js"></script>
//     <script type="module" src="globepretty.js"></script>
// Also make sure to copy the dist/images files to your /images folder.
//////////////////////////////////////////////////////////////////////////////

const version = "1.0.0";

const OrigGlobe = Globe;

Globe = function(container, opts)
{
  Globe.globePrettyVersion = version;

  Globe.THREE = null;

  // Planet details
  // The images came from http://unpkg.com/three-globe/example/img/...
  // and from https://planetpixelemporium.com
  const _planet =
  {
    earth:
    {
      radius: 6371, // in miles
      atmosphere: true,

      // Originally at http://unpkg.com/three-globe/example/img/earth-blue-marble.jpg
      imageURL: './images/earth-day.jpg',

      // Originally at http://unpkg.com/three-globe/example/img/earth-blue-marble.jpg
      nightImageURL: './images/earth-night.jpg',

      // Originally at http://unpkg.com/three-globe/example/img/earth-topology.png
      bumpImageURL: './images/earth-bump.png',

      // Originally at http://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png
      waterURL: './images/earth-water.png',

      // How much to exaggerate the bump map
      bumpScale: 10,

      // Altitude to show clouds
      cloudsAltitude: 0.015,

      // How fast to rotate the clouds in deg/frame
      cloudsRotateSpeed: 0.006,

      // The url of the clouds
      cloudsURL: './images/earth-clouds.png'
    },

    moon:
    {
      radius: 1080,
      atmosphere: false,

      imageURL: './images/moon.jpg',
      bumpImageURL: './images/moon_bump.jpg',
      bumpScale: 1
    },

    mercury:
    {
      radius: 1516,
      atmosphere: false,

      imageURL: './images/mercury.jpg',
      bumpImageURL: './images/mercury-bump.jpg',
      bumpScale: 1
    },

    venus:
    {
      radius: 3760.4,
      atmosphere: false,

      imageURL: './images/venus.jpg',
      bumpImageURL: './images/venus-bump.jpg',
      bumpScale: 1
    },

    mars:
    {
      radius: 2106,
      atmosphere: false,

      imageURL: './images/mars.jpg',
      bumpImageURL: './images/mars-bump.jpg',
      bumpScale: 1
    },

    jupiter:
    {
      radius: 43441,
      atmosphere: false,
      imageURL: './images/jupiter.jpg'
    },

    saturn:
    {
      radius: 36184,
      atmosphere: false,
      imageURL: './images/saturn.jpg'
    },

    uranus:
    {
      radius: 15759,
      atmosphere: false,
      imageURL: './images/uranus.jpg'
    },

    neptune:
    {
      radius: 15299,
      atmosphere: false,
      imageURL: './images/neptune.jpg'
    },

    pluto:
    {
      radius: 738.38,
      atmosphere: false,
      imageURL: './images/pluto.jpg',
      bumpImageURL: './images/pluto-bump.jpg',
      bumpScale: 1
    },

    sun:
    {
      radius: 432288,
      atmosphere: false,
      imageURL: './images/sun.jpg'
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

           // Specify the planet to use: earth, moon, mercury, venus, mars, jupiter,
           // saturn, uranus, neptune, pluto, or sun
           planet: 'earth',

           // Specify one of 'day', 'night', or 'daynight' (which blends day/night
           // images according to where the sun is right now)
           dayMode: 'day',

           // The url of the background stars
           starsURL: './images/night-sky.png',

           // Whether to increase performance at the expense of precision
           maxPerformance: false,

           // Whether the surface should receive shadows cast by other objects in
           // the scene
           receiveShadows: false,

           ...opts };

  if (opts.maxPerformance)
    opts.rendererConfig = { antialias: false, alpha: false, precision: 'lowp' };

  const g = new OrigGlobe(container, opts);

  let controls = g.controls();
  const camera = g.camera();

  // Apply tile server if given
  if (opts.tileEngineURL)
  {
    g.globeTileEngineUrl((x, y, l) => opts.tileEngineURL.replace('${x}', x)
                                                        .replace('${y}', y)
                                                        .replace('${l}', l));
  }

  // Use the given planet or the one specified by name
  const planet = typeof opts.planet == 'object'
                   ? opts.planet : _planet[opts.planet];
 
  // If there's no night image for this planet, we must use day mode
  if (!planet.nightImageURL)
    opts.dayMode = 'day';

  // Apply images
  if (!opts.tileEngineURL && planet?.imageURL && opts.dayMode !== 'daynight')
    g.globeImageUrl(opts.dayMode === 'night' ? planet.nightImageURL : planet.imageURL);
  if (!opts.tileEngineURL && planet?.bumpImageURL && opts.dayMode !== 'daynight')
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
    // Face the user's longitude
    const _userLatLng = _getUserLatLng();
    g.pointOfView(_userLatLng);

    // Auto-rotate the globe if requested
    g.spinGlobe(opts.autoRotateSpeed);

    if (opts.tileEngineURL || opts.dayMode === 'daynight')
      await _showSurface();
    if (opts.showClouds)
      await g.showClouds(true);

    if (_globeReadyCbfn)
      _globeReadyCbfn();

    setTimeout(() => _globeready = true, 1);
  });

  // Get a very approx lat/lng for user without geolocating - just good
  // enough for initial view of the planet
  const _getUserLatLng = function()
  {
    // Use timezone offset to derive an approx longitude
    const date = new Date();
    const offsetHrs = date.getTimezoneOffset() / -60;
    const lng = offsetHrs * 15;

    // Use daylight savings time to derive N/S hemisphere
    const yr = date.getFullYear();
    let jan = -(new Date(yr, 0, 1, 0, 0, 0, 0).getTimezoneOffset());
    let jul = -(new Date(yr, 6, 1, 0, 0, 0, 0).getTimezoneOffset());
    const lat = jan - jul < 0 ? 30 : (jan - jul > 0 ? -30 : 0);

    return { lat, lng };
  }

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
    controls.autoRotate = speed === 0 ? false : true;
    controls.autoRotateSpeed = _spinspeed;
  }

  ///////////////////////////////////////////////////////////////////////////
  // REALISTIC SURFACE OVERLAY
  ///////////////////////////////////////////////////////////////////////////

  // Show or hide the surface overlay
  let _surface, _solar;
  const _showSurface = async function()
  {
    await _loadThreeJS();

    _solar = opts.dayMode === 'daynight'
               ? await import('./dependency/solar-calculator.mjs')
               : null;

    const planetimage = opts.dayMode === 'night' ? planet.nightImageURL : planet.imageURL;

    const surfaceTexture = await new Globe.THREE.TextureLoader().loadAsync(planetimage);
    const bumpTexture = planet.bumpImageURL 
                        ? await new Globe.THREE.TextureLoader().loadAsync(planet.bumpImageURL)
                        : null;
    const waterTexture = planet.waterURL
                         ? await new Globe.THREE.TextureLoader().loadAsync(planet.waterURL)
                         : null;
    const surface2Texture = opts.dayMode === 'daynight' 
                              ? await new Globe.THREE.TextureLoader().loadAsync(planet.nightImageURL)
                              : null;

    const matopts = opts.dayMode === 'night' 
                     ? { color: 0x000000, emissive: 0xffffff, emissiveMap: surfaceTexture }
                     : { };
    const mat = opts.dayMode === 'daynight'
                  ? _createDayNightMaterial(surfaceTexture, surface2Texture)
                  : waterTexture
                    ? new Globe.THREE.MeshPhongMaterial({ ...matopts, map: surfaceTexture, 
                                                          transparent: true, bumpMap: bumpTexture,
                                                          bumpScale: planet.bumpScale,
                                                          specularMap: waterTexture,
                                                          specular: new Globe.THREE.Color('lightgrey'),
                                                          shininess: 15
                                                        })
                    : new Globe.THREE.MeshLambertMaterial({ ...matopts, map: surfaceTexture, 
                                                            transparent: true, bumpMap: bumpTexture,
                                                            bumpScale: planet.bumpScale
                                                          });
    const widthSegments = Math.max(4, Math.round(360 / g.globeCurvatureResolution()));
    const geo = new Globe.THREE.SphereGeometry(g.getGlobeRadius() * (1 + opts.surfaceAltitude), 
                                               widthSegments, widthSegments/2);
    _surface = new Globe.THREE.Mesh(geo, mat);

    // Cast and accept shadows if we should
    if (opts.receiveShadows)
      _setupShadows();

    // If water, change light position to see the specularMap's effect
    const dirlight = g.lights().find(l => l.type === 'DirectionalLight');
    dirlight && dirlight.position.set(1, 1, 1);

    // Set sun position
    if (opts.dayMode === 'daynight')
      _startSunLifeLoop();

    // Add the surface to the scene
    g.scene().add(_surface);
  }

  let _prevSurfaceOpacity;
  const _changeSurfaceOpacity = function(altitude)
  {
    if (!_surface || !opts.tileEngineURL)
      return;

    const opacity1alt = 1;
    const opacity0alt = .4;

    const opacity = Math.min(1, Math.max(0, (altitude - opacity0alt) / (opacity1alt - opacity0alt)));

    if (_solar)
      _surface.material.uniforms.opacity.value = opacity;
    else
      _surface.material.opacity = opacity;

    // When we start, the camera is far from the planet's surface and its near value
    // is 0.05. Anything less than that causes depth z-fighting and surface flickering.
    // But we need it to be less than this if we want to be able to zoom beyond slippy
    // map zoom level 14. So we cheat and only change the camera near value to the
    // smaller value when we are fully zoomed beyond the surface layer.
    if (_prevSurfaceOpacity > 0 && opacity === 0)
      _changeCameraNear(1e-5);
    else if (_prevSurfaceOpacity === 0 && opacity > 0)
      _changeCameraNear(0.05);
    _prevSurfaceOpacity = opacity;

    _changeCameraAngle(altitude);
  };
  
  const _changeCameraNear = function(near)
  {
    // Allow us to zoom in beyond zoom 14
    camera.near = near;
    camera.far = g.getGlobeRadius() * 100;
    controls.minDistance = g.getGlobeRadius() * (1 + 5 / 2**g.globeTileEngineMaxLevel());
    controls.maxDistance = camera.far - g.getGlobeRadius();
    camera.updateProjectionMatrix();
  };

  const _changeCameraAngle = function(alt)
  {
    const maxTiltY = 80;
    const startTiltAlt = 0;
    const endTiltAlt = .05;
    const width = endTiltAlt - startTiltAlt;
    const center = startTiltAlt + width/2;
    const y = _cosineHump(alt, center, width, maxTiltY);

    if (controls.facing)
      controls.facing.y = y;
  };

  /**
   * Calculates a single cosine hump function value for a given x.
   * The hump is zero outside the range [center - width/2, center + width/2].
   *
   * @param {number} x The input value.
   * @param {number} center The x-coordinate where the hump is centered (peak location).
   * @param {number} width The total width of the hump's base.
   * @param {number} height The maximum height (amplitude) of the hump.
   * @returns {number} The value of the cosine hump at x.
   */
   const _cosineHump = (x, center, width, height) =>
   {
     // Define the boundaries where the function is non-zero
     const halfWidth = width / 2;
     const xMin = center - halfWidth;
     const xMax = center + halfWidth;

     // Check if x is outside the active range (compact support)
     if (x < xMin || x > xMax)
        return 0;

     // Map the current x value from the custom range [xMin, xMax]
     // to the standard cosine range [0, 2*Math.PI] for one full period.
     // However, for a single *hump* that goes from 0 to 1 and back to 0,
     // we use a mapping to [ -Math.PI, Math.PI ] and shift the cosine result.
     // A mapping to [0, 2*Math.PI] and a vertical shift also works.
     const scaledX = (x - xMin) / width; // scales x from [xMin, xMax] to [0, 1]
    
     // The formula for the hump:
     // We use a half-period of the cosine wave, shifted vertically.
     // cos(scaledX * 2 * Math.PI) ranges from 1 to 1 to 1 over [0, 1]. This isn't right.
     // We need a function that goes from -pi to pi for the smooth ramp up and down.
    
     // Re-scaling x to be in the range [0, Math.PI] for half a cosine wave
     const angle = scaledX * Math.PI; 

     // The expression Math.cos(angle) goes from 1 to -1 over the interval [0, Math.PI].
     // We need to shift and scale it to go from 0 to 1 to 0 (which it doesn't).
    
     // Let's use the formula from the previous answer which uses one full period,
     // vertically shifted: 0.5 * (Math.cos(...) + 1)
     const angleFullPeriod = (x - center) * (2 * Math.PI / width);

     // This expression 0.5 * (Math.cos(angleFullPeriod) + 1) ranges from 0 to 1 and
     // back to 0 over the correct interval.
     const baseHump = 0.5 * (Math.cos(angleFullPeriod) + 1);

     // Apply the desired height (amplitude)
     return height * baseHump;
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

  const _startSunLifeLoop = function()
  {
    _moveSunToPositionAtDate();

    // Update once per minute
    setInterval(_moveSunToPositionAtDate, 60 * 1000);
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

    return new Globe.THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: daytexture },
          nightTexture: { value: nighttexture },
          sunPosition: { value: new Globe.THREE.Vector2() },
          globeRotation: { value: new Globe.THREE.Vector2() },
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
    await _loadThreeJS();

    return new Promise(resolve =>
    {
      // Create the clouds texture
      new Globe.THREE.TextureLoader().load(planet.cloudsURL, cloudsTexture => 
      {
        const widthSegments = Math.max(4, Math.round(360 / g.globeCurvatureResolution()));

        _clouds = new Globe.THREE.Mesh(
          new Globe.THREE.SphereGeometry(g.getGlobeRadius() * (1 + planet.cloudsAltitude), 
                                         widthSegments, widthSegments/2),
          new Globe.THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
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

  ///////////////////////////////////////////////////////////////////////////
  // THREE JS
  ///////////////////////////////////////////////////////////////////////////

  const _loadThreeJS = async function()
  {
    if (!Globe.THREE)
    {
      // We dont want three.js to complain that it was brought in again
      // after being brought in by global.gl, but we have to bring it in
      // again, because global.gl doesnt expose it. Here we just delete
      // the flag that three.js uses to detect that it was already loaded.
      //delete window.__THREE__;

      Globe.THREE = await import('three');

      // Override the orbital controls update() function, so that we
      // can look at something other than what we are orbiting
      const oldupdate = controls.update.bind(controls);
      controls.facing = (new Globe.THREE.Vector3()).copy(controls.target);
      controls.update = ((...args) =>
      {
        const result = oldupdate(...args);
        camera.lookAt(controls.facing);
        return result;
      }).bind(controls);
    }
  }

  ///////////////////////////////////////////////////////////////////////////
  // SHADOWS
  ///////////////////////////////////////////////////////////////////////////

  const _setupShadows = () =>
  {
    g.renderer().shadowMap.enabled = true;
    _surface.receiveShadow = true;

    g.lights().filter(l => l.type === 'DirectionalLight')
              .forEach(l => 
                       {
                         l.castShadow = true;
                         //l.shadow.mapSize.width = 1024;
                         //l.shadow.mapSize.height = 1024;
                         //l.shadow.bias = -0.001; // Adjust for artifacts (penumbra)
                         const R = g.getGlobeRadius() * 1.2; // Only objs within 20% of surface cast shadows
                         l.shadow.camera.top = R;
                         l.shadow.camera.bottom = -R;
                         l.shadow.camera.left = -R;
                         l.shadow.camera.right = R;
                         l.shadow.camera.near = -R;
                         l.shadow.camera.far = R;
                         //g.scene().add( new Globe.THREE.CameraHelper( l.shadow.camera ) );
                       });
  };

  // Make the given THREEJS object cast shadows
  g.castShadows = obj =>
  {
    if (!obj)
      obj = g.scene();
    if (!obj || typeof obj.traverse !== 'function')
      return;

    obj.traverse(child =>
    {
      if (child.isMesh)
        child.castShadow = true;
    });
  };

  return g;
}

