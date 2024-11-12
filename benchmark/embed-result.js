const {
  title = "Benchmark Results",
  backgroundColor = "#ffffff",
  font = "Arial",
  vusLabel = "Number of Virtual Users",
  vusColor = "gray",
  durationLabel = "Average Response Time (s)",
  durationColor = "green",
  durationPeriod = 5 * 60 * 1000, // 5 minutes,
  throughputLabel = "Throughput (req/s)",
  throughputColor = "blue",
  throughputPeriod = 60 * 1000, // 1 minute
  dataUrl,
} = window.benchmarkViz;

function getRollingAverage(data, period, metric) {
  const rolling = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = i;
      j >= 0 && data[i].timeFromStart - data[j].timeFromStart < period;
      j--
    ) {
      sum += data[j][metric];
      count++;
    }
    rolling.push({
      timeFromStart: data[i].timeFromStart,
      [metric]: sum / count,
    });
  }
  return rolling;
}

/**
 * Convert milliseconds to a human readable time format
 * @param {number} ms - milliseconds
 * @returns {string} - time in the format HH:MM:SS
 */
function msToTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(
    2,
    "0"
  )}:${String(seconds % 60).padStart(2, "0")}`;
}

async function render() {
  const response = await fetch(dataUrl);
  const results = await response.json();
  const div = document.querySelector("#benchmarkViz");

  const vus = results
    .filter((r) => r.metric === "vus")
    .map((r) => ({
      timeFromStart: r.data.timeFromStart,
      [vusLabel]: r.data.value,
    }));
  const duration = results
    .filter((r) => r.metric === "http_req_duration")
    .map((r) => ({
      timeFromStart: r.data.timeFromStart,
      [durationLabel]: r.data.value / 1000,
    }));

  const rollingDuration = getRollingAverage(
    duration,
    durationPeriod,
    durationLabel
  );

  // Throughput is the number of http_req_duration per second, taken in 1 minute intervals
  const throughput = duration.map((d, i) => {
    const { timeFromStart } = d;
    const count = duration
      .slice(i)
      .filter((d) => d.timeFromStart - timeFromStart < throughputPeriod).length;
    return {
      timeFromStart,
      [throughputLabel]: count / (throughputPeriod / 1000),
    };
  });
  const rollingThroughput = getRollingAverage(
    throughput,
    durationPeriod,
    throughputLabel
  );

  const vusLine = {
    x: vus.map((d) => d.timeFromStart),
    y: vus.map((d) => d[vusLabel]),
    hovertemplate: `%{text}: %{y} VUs`,
    text: vus.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: vusLabel,
    line: { color: vusColor },
    yaxis: "y",
  };

  const durationLine = {
    x: rollingDuration.map((d) => d.timeFromStart),
    y: rollingDuration.map((d) => d[durationLabel]),
    hovertemplate: `%{text}: %{y:.2f}s`,
    text: rollingDuration.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: durationLabel,
    line: { color: durationColor },
    yaxis: "y2",
  };

  const throughputLine = {
    x: rollingThroughput.map((d) => d.timeFromStart),
    y: rollingThroughput.map((d) => d[throughputLabel]),
    hovertemplate: `%{text}: %{y:.2f} req/s`,
    text: rollingThroughput.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: throughputLabel,
    line: { color: throughputColor },
    yaxis: "y3",
  };

  const data = [vusLine, durationLine, throughputLine];

  const tenMinutes = 10 * 60 * 1000;
  const layout = {
    title,
    plot_bgcolor: backgroundColor,
    font: { family: font },
    legend: { x: 0, y: -0.3, orientation: "h" },
    xaxis: {
      title: "Time",

      // 10 minute increments in ms
      tickvals: Array.from(
        {
          length: Math.ceil(
            Math.max(...vus.map((d) => d.timeFromStart)) / tenMinutes
          ),
        },
        (_, i) => i * tenMinutes
      ),
      ticktext: Array.from(
        {
          length: Math.ceil(
            Math.max(...vus.map((d) => d.timeFromStart)) / tenMinutes
          ),
        },
        (_, i) => msToTime(i * tenMinutes)
      ),
    },
    yaxis: {
      title: vusLabel,
      side: "left",
      color: vusColor,
      range: [0, Math.max(...vus.map((d) => d[vusLabel])) * 1.3],
    },
    yaxis2: {
      title: durationLabel,
      side: "right",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: durationColor,
      range: [
        0,
        Math.max(...rollingDuration.map((d) => d[durationLabel])) * 1.3,
      ],
    },
    yaxis3: {
      title: throughputLabel,
      side: "right",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: throughputColor,
      range: [
        0,
        Math.max(...rollingThroughput.map((d) => d[throughputLabel])) * 1.3,
      ],
    },
  };
  Plotly.newPlot(div, data, layout);
}

render();
