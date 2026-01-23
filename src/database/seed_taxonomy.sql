-- WARNING: This script will DELETE ALL DATA from disciplines, subdisciplines, topics, and consequently question_logs and scheduled_reviews.
-- Run this in the Supabase SQL Editor.

BEGIN;

-- 1. Clean existing data
TRUNCATE TABLE disciplines RESTART IDENTITY CASCADE;
TRUNCATE TABLE subdisciplines RESTART IDENTITY CASCADE;
TRUNCATE TABLE topics RESTART IDENTITY CASCADE;

-- 2. Insert Disciplines
INSERT INTO disciplines (id, name) VALUES
(1, 'Clínica Médica'),
(2, 'Cirurgia Geral e Trauma'),
(3, 'Pediatria'),
(4, 'Ginecologia e Obstetrícia'),
(5, 'Saúde Coletiva / Preventiva');

-- 3. Insert Subdisciplines
INSERT INTO subdisciplines (id, discipline_id, name) VALUES
-- Clínica Médica (1)
(1, 1, 'Cardiologia'),
(2, 1, 'Pneumologia'),
(3, 1, 'Gastroenterologia / Hepatologia'),
(4, 1, 'Endocrinologia'),
(5, 1, 'Nefrologia'),
(6, 1, 'Hematologia'),
(7, 1, 'Neurologia'),
(8, 1, 'Infectologia'),
(9, 1, 'Reumatologia'),
(10, 1, 'Geriatria / Psiquiatria'),
-- Cirurgia (2)
(11, 2, 'Geral e Trauma'),
(12, 2, 'Aparelho Digestivo / Oncologia Cirúrgica'),
-- Pediatria (3)
(13, 3, 'Pediatria Geral'),
(14, 3, 'Neonatologia'),
-- GO (4)
(15, 4, 'Obstetrícia'),
(16, 4, 'Ginecologia'),
(17, 4, 'Oncologia Ginecológica'),
-- Preventiva (5)
(18, 5, 'Saúde Coletiva');

-- 4. Insert Topics
INSERT INTO topics (subdiscipline_id, name) VALUES
-- Cardiologia (1)
(1, 'Arritmias'),
(1, 'Insuficiência Cardíaca'),
(1, 'Doença Arterial Coronariana (DAC)'),
(1, 'Valvopatias'),
(1, 'Endocardite Infecciosa'),
(1, 'TVP/TEP'),
(1, 'Hipertensão Portal'),
(1, 'Febre Reumática'),

-- Pneumologia (2)
(2, 'Pneumonias e Derrame Pleural'),
(2, 'DPOC'),
(2, 'Tuberculose'),
(2, 'Asma em Adulto'),

-- Gastro/Hepato (3)
(3, 'Doenças Benignas do Estômago e DRGE'),
(3, 'Obstrução Intestinal'),
(3, 'Síndromes Diarreicas'),
(3, 'Cirrose Hepática e Complicações'),
(3, 'Sangramento Gastrointestinal'),
(3, 'Hepatites Virais'),
(3, 'Insuficiência Hepática Aguda'),

-- Endocrinologia (4)
(4, 'Diabetes'),
(4, 'HAS'),
(4, 'Doenças da Tireoide'),
(4, 'Doenças da Hipófise, Suprarrenais e Obesidade'),
(4, 'Dislipidemia'),
(4, 'Paratireoides'),

-- Nefrologia (5)
(5, 'Insuficiência Renal Aguda'),
(5, 'Glomerulopatias'),
(5, 'Distúrbios Hidroeletrolíticos'),
(5, 'Distúrbios Ácido-Básicos'),
(5, 'Doença Renal Crônica'),

-- Hematologia (6)
(6, 'Anemias Hipoproliferativas'),
(6, 'Anemias Hiperproliferativas'),
(6, 'Displasias Hematológicas'),
(6, 'Distúrbios da Hemostasia'),

-- Neurologia (7)
(7, 'AVC'),
(7, 'Cefaleias'),
(7, 'Convulsão'),
(7, 'Neuropatias'),

-- Infectologia (8)
(8, 'HIV/AIDS'),
(8, 'Infecções do SNC'),
(8, 'Sepse'),
(8, 'Síndromes Febris'),
(8, 'Arboviroses'),

-- Reumatologia (9)
(9, 'Artrites'),
(9, 'Vasculites'),
(9, 'Colagenoses'),

-- Geriatria/Psiquiatria (10)
(10, 'Geriatria'),
(10, 'Demências / Parkinsonismo / Delirium'),
(10, 'Depressão e Suicídio'),
(10, 'Ansiedade e Estresse Pós-Traumático'),
(10, 'Dependência de Álcool, Drogas e Tabaco'),

-- Geral e Trauma (11)
(11, 'Abdome Agudo'),
(11, 'Perioperatório'),
(11, 'Avaliação Inicial do Trauma'),
(11, 'Trauma de Abdome e Pelve'),
(11, 'Hérnias de Parede Abdominal'),
(11, 'Obstrução Intestinal'),
(11, 'Trauma de Tórax'),
(11, 'TCE'),
(11, 'Sangramento Gastrointestinal'),
(11, 'Queimaduras'),

-- Aparelho Digestivo / Oncologia (12)
(12, 'Doenças Benignas das Vias Biliares'),
(12, 'Neoplasias de Colon, Reto e Canal Anal'),
(12, 'Doenças Malignas das Vias Biliares'),
(12, 'Câncer de Estômago'),
(12, 'Neoplasias Hepáticas e Esplênicas'),
(12, 'Doenças Benignas do Esôfago'),
(12, 'Câncer de Esôfago'),

-- Pediatria Geral (13)
(13, 'Infecções de Vias Aéreas Inferiores'),
(13, 'Doenças Exantemáticas'),
(13, 'Diarreia e Desidratação'),
(13, 'Crescimento e Desenvolvimento'),
(13, 'Asma em Pediatria'),

-- Neonatologia (14)
(14, 'Exame Físico do RN'),
(14, 'Icterícia Neonatal'),
(14, 'Reanimação Neonatal'),
(14, 'Infecções Congênitas'),
(14, 'Sepse Neonatal'),

-- Obstetrícia (15)
(15, 'Pré-natal'),
(15, 'Doenças Hipertensivas da Gravidez'),
(15, 'Sangramento na 1ª Metade da Gestação'),
(15, 'Sangramento na 2ª Metade'),
(15, 'Trabalho de Parto Prematuro'),
(15, 'Diabetes na Gravidez'),

-- Ginecologia (16)
(16, 'Anticoncepção'),
(16, 'SOP'),
(16, 'Endometriose'),
(16, 'Climatério'),
(16, 'Amenorreias'),

-- Oncologia Ginecológica (17)
(17, 'Neoplasias de Mama'),
(17, 'Neoplasias de Endométrio'),
(17, 'Neoplasias de Colo de Útero'),
(17, 'Neoplasias de Ovário'),

-- Saúde Coletiva (18)
(18, 'Atenção Básica – ESF'),
(18, 'Princípios da Atenção Primária'),
(18, 'Estudos Epidemiológicos (tipos)'),
(18, 'Indicadores de Saúde'),
(18, 'Vigilância Epidemiológica – DNC'),
(18, 'SUS – Princípios'),
(18, 'SUS – Programas');

COMMIT;
