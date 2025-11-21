#!/bin/bash
# Setup PostgreSQL database for autoagent

sudo -u postgres psql <<EOF
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'hendo420') THEN
    CREATE USER hendo420 WITH PASSWORD 'Country1!';
  END IF;
END
\$\$;

-- Grant superuser privileges
ALTER USER hendo420 WITH SUPERUSER;

-- Create database if not exists
SELECT 'CREATE DATABASE autoagent OWNER hendo420'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'autoagent')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE autoagent TO hendo420;
EOF

