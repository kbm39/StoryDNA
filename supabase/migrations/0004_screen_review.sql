-- Allow a third review perspective: 'screen' (producer's read for TV/film adaptation).
alter table reviews drop constraint if exists reviews_perspective_check;
alter table reviews
  add constraint reviews_perspective_check
  check (perspective in ('commercial', 'craft', 'screen'));
