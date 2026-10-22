-- Migration 007: Update all posts media_urls and thumbnail_url to public GCS paths
UPDATE posts
SET 
  media_urls = ARRAY(
    SELECT REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(u, 'http://10.0.2.2:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'),
          'http://localhost:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
        ),
        'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
      ),
      'http://knotnex-backend-389663780266.asia-south1.run.app/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
    )
    FROM unnest(media_urls) AS u
  ),
  thumbnail_url = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(thumbnail_url, 'http://10.0.2.2:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'),
        'http://localhost:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
      ),
      'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
    ),
    'http://knotnex-backend-389663780266.asia-south1.run.app/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
  )
WHERE (thumbnail_url LIKE '%/uploads/%' OR array_to_string(media_urls, ',') LIKE '%/uploads/%');
