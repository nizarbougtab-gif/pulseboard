-- PulseBoard — Seed des hôpitaux sénégalais de référence
-- À exécuter une seule fois après la migration initiale

INSERT IGNORE INTO hospitals (name, city, address, phone) VALUES
  ('CHU Aristide Le Dantec', 'Dakar', 'Avenue Pasteur, Dakar', '+221 33 822 24 20'),
  ('CHU de Fann', 'Dakar', 'Avenue Cheikh Anta Diop, Dakar', '+221 33 869 18 18'),
  ('Hôpital Principal de Dakar', 'Dakar', 'Avenue Nelson Mandela, Dakar', '+221 33 839 50 50'),
  ('Hôpital Abass Ndao', 'Dakar', 'Boulevard du Centenaire, Dakar', '+221 33 849 78 00'),
  ('CHR de Thiès', 'Thiès', 'Avenue Léopold Sédar Senghor, Thiès', '+221 33 951 11 93'),
  ('Hôpital de Ziguinchor', 'Ziguinchor', 'Quartier Santhiaba, Ziguinchor', '+221 33 991 21 15'),
  ('Hôpital de Tambacounda', 'Tambacounda', 'Route de Kolda, Tambacounda', '+221 33 981 10 01'),
  ('Centre de Santé de Pikine', 'Pikine', 'Pikine, Dakar', '+221 33 834 23 45'),
  ('Hôpital Régional de Saint-Louis', 'Saint-Louis', 'Rue Samba Diéry Diallo, Saint-Louis', '+221 33 961 15 25'),
  ('CHR de Kaolack', 'Kaolack', 'Route de Dakar, Kaolack', '+221 33 941 29 53'),
  ('Hôpital de Diourbel', 'Diourbel', 'Quartier Médina, Diourbel', '+221 33 971 17 42'),
  ('Hôpital Youssou Mbargane', 'Rufisque', 'Rufisque, Dakar', '+221 33 836 17 60');
