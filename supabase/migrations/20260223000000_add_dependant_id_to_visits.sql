ALTER TABLE visits ADD COLUMN dependant_id UUID REFERENCES dependants(id);
