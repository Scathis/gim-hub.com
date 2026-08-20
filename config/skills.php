<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Day-view Skill History Bucket Size
    |--------------------------------------------------------------------------
    |
    | Controls how finely the per-member "Day" skill-history graph buckets
    | snapshots (in minutes). Must evenly divide 60 — it also drives the
    | cron cadence of the `skills:aggregate` schedule (see
    | routes/console.php), and an uneven divisor produces an uneven cadence
    | at the top of each hour.
    |
    */

    'day_bucket_minutes' => (int) env('SKILLS_DAY_BUCKET_MINUTES', 15),

];
