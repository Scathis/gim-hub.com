<?php

use Illuminate\Support\Facades\Schedule;

$skillsDayBucketMinutes = (int) config('skills.day_bucket_minutes');

if ($skillsDayBucketMinutes < 1 || 60 % $skillsDayBucketMinutes !== 0) {
    throw new RuntimeException(
        "SKILLS_DAY_BUCKET_MINUTES ({$skillsDayBucketMinutes}) must be a positive divisor of 60 (e.g. 5, 10, 15, 20, 30, 60)."
    );
}

Schedule::command('skills:aggregate')->cron("*/{$skillsDayBucketMinutes} * * * *");
Schedule::command('skills:retention')->daily();
Schedule::command('member-snapshots:create')->everyFourHours();
Schedule::command('horizon:snapshot')->everyFiveMinutes();
