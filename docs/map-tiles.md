# Map tiles

The public OpenStreetMap tile server (`tile.openstreetmap.org`) was the production basemap. Its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) is for light, non-commercial use and lets the OSMF block heavy users without notice. It is not meant to back an application's traffic, so it is no longer used anywhere.

## Decision: OpenFreeMap vector tiles (default)

| | |
| --- | --- |
| Provider | [OpenFreeMap](https://openfreemap.org/), vector tiles in the OpenMapTiles schema, built from OpenStreetMap |
| Styles | Light: `https://tiles.openfreemap.org/styles/liberty`. Dark: `https://tiles.openfreemap.org/styles/fiord` |
| Account / API key | None |
| Limits / cost | No request limits or fees are stated by the service; it is funded by donations |
| Licence and attribution | OpenStreetMap data (ODbL) and the OpenMapTiles schema. The attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" comes with the style and is shown by MapLibre's attribution control (bottom right). It must stay visible |
| Fit | Native MapLibre styles, so the existing MapLibre setup, clustering, pins and controls are unchanged; vector tiles are small, and a dark style is available for dark mode |

Why "liberty" and "fiord": liberty has readable street and place names, which residents need when placing a pin; fiord is a blue-grey dark style that keeps the map in the same ink-navy family as the interface instead of a near-black map.

## Alternatives considered

Terms and free tiers change; check each provider's current pricing and terms before switching.

| Option | Pros | Cons |
| --- | --- | --- |
| **OpenFreeMap** (chosen) | Free, no key, no stated limits, vector, light and dark styles | Community-run, no SLA |
| Self-hosted OpenFreeMap or [Protomaps](https://protomaps.com/) PMTiles on S3/R2 | Full control, very cheap (one file plus static hosting), no third party at runtime | You run the hosting and update the data; extra setup |
| MapTiler Cloud | SLA, many styles, satellite | API key, free tier capped (about 100k requests/month), paid above |
| Stadia Maps | SLA, good styles | API key or domain allow-list; free tier for non-commercial use only |
| Carto basemaps | Familiar light/dark styles | Free use limited to non-commercial or Carto customers |
| `tile.openstreetmap.org` | Free | Not allowed for application traffic (see above) |

For a municipal service with modest traffic, OpenFreeMap is enough, and it can be swapped without code changes. If an SLA becomes a requirement, self-host the same tiles (no key) or move to MapTiler.

## Configuration

All `NEXT_PUBLIC_*` values are built into the client bundle, so set them before `npm run build` and redeploy after changing them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_MAP_STYLE_URL` | OpenFreeMap liberty | MapLibre style URL for the light theme |
| `NEXT_PUBLIC_MAP_STYLE_URL_DARK` | OpenFreeMap fiord | Style for the dark theme |
| `NEXT_PUBLIC_MAP_TILE_URL` | (unset) | Use a raster tile template instead of a style, e.g. `https://tiles.example.com/{z}/{x}/{y}.png`. Dark mode dims it |
| `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | `© OpenStreetMap contributors` | Attribution for the raster option |

Examples:

```bash
# MapTiler (key required; restrict the key to your domain in MapTiler's console)
NEXT_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY
NEXT_PUBLIC_MAP_STYLE_URL_DARK=https://api.maptiler.com/maps/streets-v2-dark/style.json?key=YOUR_KEY

# Self-hosted OpenFreeMap
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.your-domain.ph/styles/liberty
```

A key placed in a `NEXT_PUBLIC_*` variable is visible to every visitor; that is normal for map keys, which is why they must be restricted by domain at the provider.

## Resilience

If the style cannot be loaded within 8 seconds, or fails, the map switches to a plain background (no third-party request) and says "The street map is slow to load. Report pins are still shown.". Pins, clusters, the list and reporting keep working. Switching between light and dark swaps the style in place; markers are not recreated.

## Deployment checklist

1. Leave the defaults, or set the variables above in the hosting environment.
2. Build and deploy.
3. Open the map in light and dark mode; check the attribution is visible bottom right.
4. If you use a keyed provider, restrict the key to your domain and watch the provider's usage dashboard.
