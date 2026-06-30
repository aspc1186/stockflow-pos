-- Contrasena: Admin@2024
INSERT INTO usuarios (id, empresa_id, rol_id, nombre, email, username, password_hash, activo)
VALUES (
  uuid_generate_v4(), NULL,
  (SELECT id FROM roles WHERE nombre = 'superadmin'),
  'Super Administrador',
  'superadmin@posmanager.com',
  'superadmin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgRCd.6RhMFcwzEkC8Znfu',
  true
);
