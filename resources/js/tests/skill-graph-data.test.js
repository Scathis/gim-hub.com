import { describe, expect, it } from "vite-plus/test";
import { buildLineChartOptions, enumerateDateBinsForPeriod } from "../../components/skill-graph/skill-graph-data";

describe("enumerateDateBinsForPeriod", function describeDateBins() {
  it("produces bins no more than 15 minutes apart for Realtime", function testRealtimeBins() {
    const bins = enumerateDateBinsForPeriod("Realtime");

    expect(bins.length).toBeGreaterThan(1);

    for (let index = 1; index < bins.length; index++) {
      const gapMs = bins[index].getTime() - bins[index - 1].getTime();
      expect(gapMs).toBeGreaterThan(0);
      expect(gapMs).toBeLessThanOrEqual(15 * 60 * 1000);
    }
  });

  it("keeps Day bins hourly, unaffected by the Realtime change", function testDayBinsUnaffected() {
    const bins = enumerateDateBinsForPeriod("Day");

    // Check a gap between two regular hourly bins, not the trailing "now"
    // point (which can be less than an hour after the last hourly boundary
    // and would make this assertion flaky).
    expect(bins.length).toBeGreaterThan(2);
    const regularGapMs = bins[1].getTime() - bins[0].getTime();
    expect(regularGapMs).toBe(60 * 60 * 1000);
  });
});

describe("buildLineChartOptions", function describeChartOptions() {
  it("forces a clean 30-minute tick grid for Realtime", function testRealtimeTickGrid() {
    const options = buildLineChartOptions({ period: "Realtime", yAxisUnit: "Total experience" });

    expect(options.scales.x.time.unit).toBe("minute");
    expect(options.scales.x.ticks.stepSize).toBe(30);
  });

  it("leaves Day's auto tick placement alone", function testDayTickGridUnaffected() {
    const options = buildLineChartOptions({ period: "Day", yAxisUnit: "Total experience" });

    expect(options.scales.x.time.unit).toBeUndefined();
    expect(options.scales.x.ticks).toBeUndefined();
  });
});
