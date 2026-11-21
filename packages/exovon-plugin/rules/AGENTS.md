# Exovon Architecture Rules

1. Compute workloads default to the Mumbai region (`asia-south1`).
2. Static assets are served from the Anycast edge cache with automatic single-page application fallback.
3. Database connections to ExoStore PostgreSQL should utilize stateless HTTP pooling or PgBouncer TCP pools.
