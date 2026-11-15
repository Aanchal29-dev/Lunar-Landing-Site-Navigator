# Scientific result boundary

Lunar Compass uses the FastAPI visibility engine for its scientific Sun and
Earth results. The engine queries NASA JPL Horizons with a lunar surface
observer, requests apparent airless azimuth/elevation for the Sun and Earth,
and returns one hourly midpoint sample for each requested mission hour.

Visibility is strictly elevation greater than zero degrees relative to a
simplified geometric horizon. The current model does not include terrain
obstruction, finite body discs, eclipses or occultations, solar-power hardware,
radio-link margins, spacecraft survival or landing safety.

The frontend must label these limitations with every result. A display Moon,
normal map or height texture is not a scientific terrain-horizon calculation.
Terrain results, when requested separately, describe coverage from the configured
regional raster and do not change the visibility engine's zero-degree horizon.

The interactive sky dial and elevation chart are presentations of the exact
hourly `azimuth_deg` and `elevation_deg` values returned by the visibility API.
The chart's 0° line is the model horizon; it is not a terrain profile. A point
outside the dial's horizon ring is labelled below that geometric horizon.

Terrain screening is optional and uses the configured regional NASA LOLA
elevation/slope rasters. It may correctly return no measurements when the
coordinate lies outside coverage, has invalid source cells, or the local data
service is unavailable. Terrain output does not constitute a hazard analysis,
terrain-shadow model, or landing certification.
