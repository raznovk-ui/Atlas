# Modele de releve terrain

`fiche_releve_terrain.csv` — une ligne par point observe sur le terrain,
remplissable a la main ou dans un tableur, puis importable directement dans
l'application (panneau Import -> choisir le fichier .csv).

## Colonnes

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `fiche_id` | non | identifiant libre, pour s'y retrouver |
| `date_observation` | **oui pour que le releve compte** | AAAA-MM-JJ. Sans date, la confiance du releve reste plafonnee bas (voir plus bas) |
| `lat`, `lon` | **oui** | coordonnees GPS, degre decimal, EPSG:4326 (pas Lambert-93) |
| `secteur`, `adresse` | non | reperes libres |
| `physical` .. `political` | non, mais au moins une pour que le point compte | note de 0 a 3, voir le bareme dans `../../src/domain/rubric.json` |
| `note_obs` | non | description libre |

Une ligne sans aucune des six colonnes de dimension notee est importee comme
observation sans note : elle apparait sur la carte mais n'influence aucun
score.

## Pourquoi la date compte autant que la note

Le moteur de calcul juge une cellule "suffisamment documentee" seulement si
l'evidence est a la fois recente et diversifiee (plusieurs sources). Un lot de
releves sans date importe se voit assigner la confiance la plus basse possible
et ne produira jamais de zone rouge, quel que soit le nombre de points -
mesure et confirme sur `signalements_voirie_marseille.geojson` (voir
`../raw/README.md`). Une seule date approximative pour tout le lot suffit deja
a debloquer le calcul.

## Alternative : GeoJSON

Le meme resultat s'obtient avec un fichier GeoJSON (voir
`../raw/signalements_voirie_marseille.geojson` pour un exemple de forme
acceptee). Le CSV est propose ici parce qu'il se remplit plus facilement a la
main ou au telephone sur le terrain.
