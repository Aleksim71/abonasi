-- seed_locations.sql — Abonasi (MVP)
-- Inserts demo locations. Safe to re-run.

BEGIN;

INSERT INTO locations (country, city, district) VALUES
-- Germany / Munich
('Germany', 'Munich', 'Altstadt-Lehel'),
('Germany', 'Munich', 'Ludwigsvorstadt-Isarvorstadt'),
('Germany', 'Munich', 'Maxvorstadt'),
('Germany', 'Munich', 'Schwabing-West'),
('Germany', 'Munich', 'Schwabing-Freimann'),
('Germany', 'Munich', 'Au-Haidhausen'),
('Germany', 'Munich', 'Sendling'),
('Germany', 'Munich', 'Sendling-Westpark'),
('Germany', 'Munich', 'Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln'),
('Germany', 'Munich', 'Neuhausen-Nymphenburg'),
('Germany', 'Munich', 'Moosach'),
('Germany', 'Munich', 'Milbertshofen-Am Hart'),
('Germany', 'Munich', 'Bogenhausen'),
('Germany', 'Munich', 'Berg am Laim'),
('Germany', 'Munich', 'Trudering-Riem'),
('Germany', 'Munich', 'Ramersdorf-Perlach'),
('Germany', 'Munich', 'Obergiesing-Fasangarten'),
('Germany', 'Munich', 'Untergiesing-Harlaching'),
('Germany', 'Munich', 'Hadern'),
('Germany', 'Munich', 'Pasing-Obermenzing'),
('Germany', 'Munich', 'Aubing-Lochhausen-Langwied'),
('Germany', 'Munich', 'Feldmoching-Hasenbergl'),
('Germany', 'Munich', 'Laim'),

-- Germany / Berlin (пару для примера)
('Germany', 'Berlin', 'Mitte'),
('Germany', 'Berlin', 'Friedrichshain-Kreuzberg'),
('Germany', 'Berlin', 'Charlottenburg-Wilmersdorf'),

-- Ukraine / Kyiv (пример)
('Ukraine', 'Kyiv', 'Podilskyi'),
('Ukraine', 'Kyiv', 'Pecherskyi'),
('Ukraine', 'Kyiv', 'Shevchenkivskyi')

ON CONFLICT (country, city, district) DO NOTHING;

COMMIT;
