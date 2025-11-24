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

      // Originally at http://unpkg.com/three-globe/example/img/earth-topology.png
      bumpImageURL: 'images/earth-topology.png'
    },

    moon:
    {
      radius: 1080,
      atmosphere: false,

      imageURL: 'images/lunar_surface.jpg',
      bumpImageURL: 'images/lunar_bumpmap.jpg'
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

           // Whether to show clouds
           showClouds: true,

           // Altitude to show clouds
           cloudsAltitude: 0.015,

           // How fast to rotate the clouds in deg/frame
           cloudsRotateSpeed: 0.006,

           // The url of the clouds
           cloudsURL: 'images/clouds.png',

           // Whether to show slippy tiles for infinite zoom
           tileEngineURL: 'https://tile.openstreetmap.org/${l}/${x}/${y}.png',

           // Specify the planet to use: earth or moon
           planet: 'earth',

           // The url of the background stars
           starsURL: 'images/night-sky.png',

           // Whether to increase performance at the expense of precision
           maxPerformance: false,

           ...opts };

  if (opts.maxPerformance)
    opts.rendererConfig = { antialias: false, alpha: false, precision: 'lowp' };

  const g = new OrigGlobe(container, opts);

  // Apply tile server
  if (opts.tileEngineURL)
  {
    g.globeTileEngineUrl((x, y, l) => opts.tileEngineURL.replace('${x}', x)
                                                        .replace('${y}', y)
                                                        .replace('${l}', l));
  }

  // Apply images
  const planet = _planet[opts.planet];
  if (!opts.tileEngineURL && planet?.imageURL)
    g.globeImageUrl(planet.imageURL);
  if (planet?.bumpImageURL)
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

    if (opts.showClouds)
      await g.showClouds(true);
    if (opts.tileEngineURL)
      await _showSurface();

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
        g.spinGlobe();
      }, opts.autoSpinAfterIdleMs);
    }
  }

  // Override zoom so we catch interactions that stop the globe spin and so
  // we can change the surface opacity if applicable
  let _onZoomCbfn;
  let _prevAlt = null;
  g.onZoom(latLngAlt =>
  {
    // We only count altitude changes as an interaction
    if (_prevAlt !== null &&
        Math.abs(_prevAlt - latLngAlt.altitude) > opts.interactionSpinThreshold)  
      _onInteraction();

    // Handle surface opacity
    if (Math.abs(_prevAlt - latLngAlt.altitude) > .00001)
      _changeSurfaceOpacity(latLngAlt.altitude);

    _prevAlt = latLngAlt.altitude;

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
  // CLOUDS
  ///////////////////////////////////////////////////////////////////////////

  // Show or hide the clouds
  let _cloudsshown = false;
  let _clouds;
  g.showClouds = async function(show)
  {
    // Do nothing if already in the desired show state
    if (show === _cloudsshown)
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
      new _three.TextureLoader().load(opts.cloudsURL, cloudsTexture => 
      {
        _clouds = new _three.Mesh(
          new _three.SphereGeometry(g.getGlobeRadius() * (1 + opts.cloudsAltitude), 75, 75),
          new _three.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
        );
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
      _clouds.rotation.y += opts.cloudsRotateSpeed * Math.PI / 180;
      if (_cloudsshown)
        requestAnimationFrame(rotateClouds);
     }
    rotateClouds();
  };

  let setCloudSpeed = function(speed)
  {
    opts.cloudsRotateSpeed = speed;
  }

  ///////////////////////////////////////////////////////////////////////////
  // REALISTIC SURFACE OVERLAY
  ///////////////////////////////////////////////////////////////////////////

  // Show or hide the surface overlay
  let _surface;
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

    return new Promise(resolve =>
    {
      // Create the surface texture
      new _three.TextureLoader().load(planet.imageURL, surfaceTexture => 
      {
        _surface = new _three.Mesh(
          new _three.SphereGeometry(g.getGlobeRadius() * (1 + 0.01), 75, 75),
          new _three.MeshPhongMaterial({ map: surfaceTexture, transparent: true })
        );

        // Add the clouds to the scene
        g.scene().add(_surface);

        resolve();
      });
    });
  }

  const _changeSurfaceOpacity = function(altitude)
  {
    if (!_surface)
      return;

    const opacity1alt = 1;
    const opacity0alt = .4;

    const opacity = Math.min(1, Math.max(0, (altitude - opacity0alt) / (opacity1alt - opacity0alt)));
    _surface.material.opacity = opacity;
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

