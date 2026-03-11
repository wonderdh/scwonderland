-- =============================================================
-- Notices Domain Schema
-- 공지사항 3종: 공개, 반별, Academy + 첨부파일
-- =============================================================

-- 공개 공지
CREATE TABLE notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text,
  excerpt      text,
  author_id    uuid REFERENCES profiles(id),
  is_published boolean DEFAULT true,
  is_pinned    boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 공개 공지 첨부파일
CREATE TABLE notice_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id         uuid NOT NULL REFERENCES notices(id),
  storage_path      text NOT NULL,
  public_url        text NOT NULL,
  original_filename text NOT NULL,
  mime_type         text NOT NULL,
  file_size         bigint NOT NULL,
  file_type         text NOT NULL,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

-- 반별 공지
CREATE TABLE class_notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES classes(id),
  author_id  uuid NOT NULL REFERENCES profiles(id),
  title      text NOT NULL,
  content    text,
  is_pinned  boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 반별 공지 첨부파일
CREATE TABLE class_notice_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_notice_id   uuid NOT NULL REFERENCES class_notices(id),
  storage_path      text NOT NULL,
  public_url        text NOT NULL,
  original_filename text NOT NULL,
  mime_type         text NOT NULL,
  file_size         bigint NOT NULL,
  file_type         text NOT NULL DEFAULT 'attachment',
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

-- Academy 공지
CREATE TABLE academy_notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text,
  excerpt      text,
  author_id    uuid REFERENCES profiles(id),
  is_published boolean DEFAULT true,
  is_pinned    boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Academy 공지 첨부파일
CREATE TABLE academy_notice_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_notice_id   uuid NOT NULL REFERENCES academy_notices(id),
  storage_path        text NOT NULL,
  public_url          text NOT NULL,
  original_filename   text NOT NULL,
  mime_type           text NOT NULL,
  file_size           bigint NOT NULL,
  file_type           text NOT NULL DEFAULT 'attachment',
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);
