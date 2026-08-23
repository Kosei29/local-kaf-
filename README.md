# Local Kafé — V2 Map

Private shared café journal and map.

## V2 features
- Supabase email/password auth
- Private group access via RLS
- Shared Leaflet + OpenStreetMap map
- Load all cafés saved by the group
- Add a café manually even if it is not listed by a map provider
- Use phone GPS for a new café
- Tap map / drag pin to correct a café location
- Save café name, type, address/area, and landmark

## How the map works
The base map is OpenStreetMap. Café pins come from the Local Kafé `cafes` table in Supabase, so a café does not need to exist in Google Maps, Waze, or OpenStreetMap first.

## Next
- Café details page
- Visit history
- Individual notes per visit
- Orders and ratings
- Want-to-visit list
