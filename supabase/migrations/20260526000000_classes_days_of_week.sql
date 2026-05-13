BEGIN;

ALTER TABLE public.classes
  ADD COLUMN days_of_week int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::int[];

ALTER TABLE public.classes
  ADD CONSTRAINT classes_days_of_week_valid CHECK (
    array_length(days_of_week, 1) BETWEEN 1 AND 5
    AND days_of_week <@ ARRAY[1,2,3,4,5]::int[]
  );

COMMIT;
