-- The إداري role: office staff, below the director (no data changes).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'administrative' AFTER 'admin';
