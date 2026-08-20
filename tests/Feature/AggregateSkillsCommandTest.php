<?php

use App\Models\SkillStat;
use Illuminate\Support\Facades\Config;

it('produces distinct day buckets for updates in the same hour but different quarter-hours', function () {
    Config::set('skills.day_bucket_minutes', 15);

    $group = $this->createSnapshotGroup();
    $member = $this->createCompleteSnapshotMember($group);
    $skillProperty = $member->properties()->where('key', 'skills')->first();
    $hourStart = now()->startOfHour();

    // The command tracks an AggregationInfo "last aggregation" wall-clock
    // high-water mark, so both the property update and the command run must
    // happen under the same travelled time for each step to be picked up
    // deterministically — a fabricated updated_at compared against the real
    // wall clock would be flaky depending on what minute the test happens to
    // run in.
    $this->travelTo($hourStart->copy()->addMinutes(5));
    $skillProperty->update(['value' => array_fill(0, 24, 150)]);
    $this->artisan('skills:aggregate')->assertSuccessful();

    $this->travelTo($hourStart->copy()->addMinutes(20));
    $skillProperty->update(['value' => array_fill(0, 24, 200)]);
    $this->artisan('skills:aggregate')->assertSuccessful();

    $dayStats = SkillStat::where('member_id', $member->id)->where('type', 'day')->orderBy('created_at')->get();

    expect($dayStats)->toHaveCount(2);
    expect($dayStats[0]->created_at->minute)->toBe(0);
    expect($dayStats[1]->created_at->minute)->toBe(15);
    expect($dayStats[0]->skills[0])->toBe(150);
    expect($dayStats[1]->skills[0])->toBe(200);
});
