# globepretty

Adds clouds, rotation, and other pretty elements



Extends the Globe class (github.com/vasturiano/globe.gl).



The Globe class visualizes point, arc, ripple, tile, and other elements

on a globe. 



### Features



This adds the following options to the opts parameter of the Globe constructor:



##### &nbsp;  autoRotateSpeed (default 0.35)

&nbsp;    Spins the globe at the given speed. Negative speed spins backward. Zero speed stops it. User interactions stop it temporarily. Note that spin can also be started and stopped with the new member function spinGlobe(speed).



##### &nbsp;  interactionSpinThreshold (default .01)

&nbsp;    How much the user needs to change the altitude value before the interaction temporarily stops the globe rotation



##### &nbsp;  autoSpinAfterIdleMs (default 15000)

&nbsp;    How long to wait after a user interaction before resuming the spin. Zero to never stop spinning



##### &nbsp;  onlySpinAboveAltitude (default .4)

&nbsp;    When zoomed in to greater than this altitude, stop spinning the globe



##### &nbsp;  showClouds (default true)

&nbsp;    Whether to show clouds. Note that clouds can also be shown or hidden with the new member function showClouds(bool).



##### &nbsp;  tileEngineURL (default 'https://tile.openstreetmap.org/${l}/${x}/${y}.png')

&nbsp;    Where to fetch slippy map tiles. If null, when zooming into the globe, the surface image gets grainier and grainier. If supplied, the surface is shifts from fully opaque at altitude 1 to fully transparent at altitude .4, revealing the slippy map tiles underneath. This provides a nice effect for zooming from a blue marble image to a useable map.



##### &nbsp;  surfaceAltitude (default 0.01)

&nbsp;    The altitude at which to place the planet surface image so that it appears above the slippy tiles (if present) and below the clouds.



##### &nbsp;  planet (default 'earth')

&nbsp;    Specify the planet to use: 'earth', 'moon', or a record of the form:

&nbsp;    {

&nbsp;      radius: int,             // Planet's radius in miles

&nbsp;      imageURL: str,           // URL of day time image of the planet

&nbsp;      // Below are optional:

&nbsp;      atmosphere: bool,        // Whether to render an atmosphere glow

&nbsp;      nightImageURL: str       // URL of night time image of the planet

&nbsp;      bumpImageURL: str        // URL of bump map image for the planet

&nbsp;      bumpScale: int,          // How much to exaggerate the bump map

&nbsp;      cloudsAltitude: float    // Altitude to show clouds

&nbsp;      cloudsRotateSpeed: float // How fast to rotate clouds in deg/frame

&nbsp;      cloudsURL: str           // URL of image to use as clouds

&nbsp;    }



##### &nbsp;  dayMode (default 'day')

&nbsp;    One of 'day' (which renders the planet's day image), 'night' (which renders the planet's night image), or 'daynight' (which blends the day and night images together based on where the sun is right now and accurately updates it once every minute).



##### &nbsp;  starsURL (default 'images/night-sky.png')

&nbsp;    The url of the background stars, used to fill the container's background.



##### &nbsp;  maxPerformance (default false)

&nbsp;    Whether to increase performance at the expense of precision. If true, sets rendererConfig to:

&nbsp;      { antialias: false, alpha: false, precision: 'lowp' }



### Notes



&nbsp;To provide a familiar view, the globe is initially set to show the user's location, which is derived solely from the local timezone.

&nbsp;

&nbsp;Resizing the globe's container automatically recenters/resizes the globe.



### To Use



&nbsp;To use this module, import it after importing globe.gl, like this:

&nbsp;    <script language="javascript" src="globe.gl.min.js"></script>

&nbsp;    <script type="module" src="globepretty.js"></script>



