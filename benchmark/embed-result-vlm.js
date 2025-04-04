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

function getBucket(data, key, start, end) {
  return data.filter((d) => d[key] >= start && d[key] < end);
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

function makePriceMap(prices) {
  const priceMap = {};
  for (const gpuObject of prices.items) {
    const gpuName = gpuObject.name.toLowerCase();
    priceMap[gpuName] = {};
    for (const priceObject of gpuObject.prices) {
      priceMap[gpuName][priceObject.priority] = parseFloat(priceObject.price);
    }
  }
  return priceMap;
}

function getPriorityLevels(priceMap) {
  const gpu = Object.keys(priceMap)[0];
  const pricesByPriority = priceMap[gpu];
  return Object.keys(pricesByPriority);
}

function getGPUNameByID(prices, id) {
  return prices.items.find((item) => item.id === id).name;
}

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function render({
  title,
  plotBackgroundColor = "#ffffff",
  font = "Verdana",
  lineWidth = 2,
  vusLabel = "Number of Virtual Users",
  vusColor = "gray",
  errorsLabel = "Error Rate (5m window)",
  errorsColor = "red",
  errorsPeriod = 5 * 60 * 1000, // 5 minutes
  durationLabel = "Average Response Time (s)",
  durationColor = "green",
  durationPeriod = 5 * 60 * 1000, // 5 minutes,
  throughputOutLabel = "Throughput (tok/s out)",
  throughputOutColor = "blue",
  throughputInLabel = "Throughput (tok/s in)",
  throughputInColor = "darkblue",
  throughputPeriod = 60 * 1000, // 1 minute
  divId = "benchmarkViz",
  interactionsDivId = "vizInteractions",
  defaultPriority = "batch",
  maxNodes = 10,
  dataUrl,
  pricesUrl,
  gpu,
  vCPUs,
  vCPUPrice = 0.004,
  memGB,
  memGBPrice = 0.001,
}) {
  if (!title) {
    title = dataUrl;
  }

  const [benchmarkData, pricesInfo] = await Promise.all([
    fetch(dataUrl),
    fetch(pricesUrl),
  ]);
  const results = await benchmarkData.json();
  const priceData = await pricesInfo.json();
  const priceMap = makePriceMap(priceData);
  const priorityLevels = getPriorityLevels(priceMap);
  const div = document.querySelector(`#${divId}`);

  const vus = [];
  const duration = [];
  const allErrors = [];
  const nodeCounts = [];
  const inputTokens = [];
  const outputTokens = [];

  for (let i = 0; i < results.timeFromStart.length; i++) {
    const [metricIndex, timeFromStart] = results.timeFromStart[i];
    const metricName = results.metric[metricIndex];
    if (metricName === "vus") {
      vus.push({
        timeFromStart,
        [vusLabel]: results.value[i],
      });
    } else if (metricName === "http_req_duration") {
      duration.push({
        timeFromStart,
        [durationLabel]: results.value[i] / 1000,
      });
    } else if (
      metricName === "http_req_failed" &&
      results.value[i] > 0
    ) {
      allErrors.push({
        timeFromStart,
        value: results.value[i],
      });
    } else if (metricName === "node_count") {
      nodeCounts.push({
        timeFromStart,
        value: results.value[i],
      });
    } else if (metricName === "inputTokens") {
      inputTokens.push({
        timeFromStart,
        value: results.value[i],
      });
    } else if (metricName === "outputTokens") {
      outputTokens.push({
        timeFromStart,
        value: results.value[i],
      });
    }
  }

  if (nodeCounts.length > 0) {
    maxNodes = Math.max(...nodeCounts.map((d) => d.value));
  }

  if (results.resources) {
    vCPUs = results.resources.cpu;
    memGB = results.resources.memory / 1024;
    gpu = getGPUNameByID(priceData, results.resources.gpu_classes[0]);
  }

  gpu = gpu.toLowerCase();

  const rollingDuration = getRollingAverage(
    duration,
    durationPeriod,
    durationLabel
  );

  const bucketedErrors = allErrors.reduce((acc, r) => {
    const bucket = Math.floor(r.timeFromStart / errorsPeriod);
    acc[bucket] = (acc[bucket] || 0) + r.value;
    return acc;
  }, {});
  const errors = Object.keys(bucketedErrors).map((timeFromStart) => ({
    timeFromStart: parseInt(timeFromStart) * errorsPeriod,
    value:
      bucketedErrors[timeFromStart] /
      getBucket(
        duration,
        "timeFromStart",
        parseInt(timeFromStart) * errorsPeriod,
        (parseInt(timeFromStart) + 1) * errorsPeriod
      ).length,
  }));

  // Throughput is the number of outputTokens per second, within the throughputPeriod
  const throughputOutTokens = outputTokens.map((d, i) => {
    const dataSlice = getBucket(
      outputTokens,
      "timeFromStart",
      d.timeFromStart - throughputPeriod,
      d.timeFromStart
    );
    const numTokens = dataSlice.reduce((acc, d) => acc + d.value, 0);
    return {
      timeFromStart: d.timeFromStart,
      [throughputOutLabel]: numTokens / (throughputPeriod / 1000),
    };
  });
  const rollingThroughputOutTokens = getRollingAverage(
    throughputOutTokens,
    throughputPeriod,
    throughputOutLabel
  );

  const throughputInTokens = inputTokens.map((d, i) => {
    const dataSlice = getBucket(
      inputTokens,
      "timeFromStart",
      d.timeFromStart - throughputPeriod,
      d.timeFromStart
    );
    const numTokens = dataSlice.reduce((acc, d) => acc + d.value, 0);
    return {
      timeFromStart: d.timeFromStart,
      [throughputInLabel]: numTokens / (throughputPeriod / 1000),
    };
  });
  const rollingThroughputInTokens = getRollingAverage(
    throughputInTokens,
    throughputPeriod,
    throughputInLabel
  );

  const getHourlyPrice = (priority) => {
    const hourlyPrice =
      (parseFloat(priceMap[gpu][priority]) +
        vCPUs * vCPUPrice +
        memGB * memGBPrice) *
      maxNodes;
    return hourlyPrice;
  };

  const getThroughputLabel = (d) => {
    const time = msToTime(d.timeFromStart);
    const displayFormat =
      document.getElementById("priceFormat")?.value || "tokPerDollar";
    const currentPriority =
      document.getElementById("prioritySelector")?.value || defaultPriority;
    const hourlyPrice = getHourlyPrice(currentPriority);
    const tokPerSecond = d[throughputOutLabel];
    const tokPerHour = tokPerSecond * 3600;
    const costPerToken = hourlyPrice / tokPerHour;
    let priceText = "";
    if (displayFormat === "tokPerDollar") {
      const tokPerDollar = 1 / costPerToken;
      priceText = `${numberWithCommas(tokPerDollar.toFixed(2))} tok/$`;
    } else {
      priceText = `$${costPerToken.toFixed(8)}/tok`;
    }

    return `${time} | ${numberWithCommas(tokPerSecond.toFixed(2))} tok/s | ${priceText}`;
  };

  const vusLine = {
    x: vus.map((d) => d.timeFromStart),
    y: vus.map((d) => d[vusLabel]),
    hovertemplate: `%{text} | %{y} VUs`,
    text: vus.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: vusLabel,
    line: { color: vusColor, width: lineWidth },
    yaxis: "y",
  };

  const errorsLine = {
    x: errors.map((d) => d.timeFromStart),
    y: errors.map((d) => d.value),
    hovertemplate: `%{text} | %{y:.2f}`,
    text: errors.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: errorsLabel,
    line: { color: errorsColor, width: lineWidth },
    yaxis: "y4",
  };

  const durationLine = {
    x: rollingDuration.map((d) => d.timeFromStart),
    y: rollingDuration.map((d) => d[durationLabel]),
    hovertemplate: `%{text} | %{y:.2f}s`,
    text: rollingDuration.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: durationLabel,
    line: { color: durationColor, width: lineWidth },
    yaxis: "y2",
  };

  const throughputOutTokensLine = {
    x: rollingThroughputOutTokens.map((d) => d.timeFromStart),
    y: rollingThroughputOutTokens.map((d) => d[throughputOutLabel]),
    hovertemplate: `%{text}`,
    text: rollingThroughputOutTokens.map(getThroughputLabel),
    type: "scatter",
    mode: "lines",
    name: throughputOutLabel,
    line: { color: throughputOutColor, width: lineWidth },
    yaxis: "y3",
  };

  const throughputInTokensLine = {
    x: rollingThroughputInTokens.map((d) => d.timeFromStart),
    y: rollingThroughputInTokens.map((d) => d[throughputInLabel]),
    hovertemplate: `%{text}`,
    text: rollingThroughputInTokens.map((d) => {
      const time = msToTime(d.timeFromStart);
      return `${time} | ${numberWithCommas(d[throughputInLabel].toFixed(2))} tok/s`;
    }),
    type: "scatter",
    mode: "lines",
    name: throughputInLabel,
    line: { color: throughputInColor, width: lineWidth },
    yaxis: "y6",
  };

  const nodeCountLine = {
    x: nodeCounts.map((d) => d.timeFromStart),
    y: nodeCounts.map((d) => d.value),
    hovertemplate: `%{text} | %{y} Nodes`,
    text: nodeCounts.map((d) => msToTime(d.timeFromStart)),
    type: "scatter",
    mode: "lines",
    name: "Node Count",
    line: { color: "purple", width: lineWidth },
    yaxis: "y5",
  };

  const data = [
    vusLine,
    durationLine,
    throughputOutTokensLine,
    throughputInTokensLine,
    errorsLine,
    nodeCountLine,
  ];

  /**
   * Calculate summary statistics
   */
  const numRequests = duration.length;
  const errorRate = allErrors.length / numRequests;
  const successRate = 1 - errorRate;
  const avgResponseTime =
    duration.reduce((acc, d) => acc + d[durationLabel], 0) / numRequests;
  const bestResponseTime = Math.min(...duration.map((d) => d[durationLabel]));
  const worstResponseTime = Math.max(...duration.map((d) => d[durationLabel]));

  const sortedDuration = duration
    .map((d) => d[durationLabel])
    .sort((a, b) => a - b);
  const p90ResponseTime =
    sortedDuration[Math.floor(sortedDuration.length * 0.9)];
  const minVUs = vus[0][vusLabel];
  const maxVUs = Math.max(...vus.map((d) => d[vusLabel]));
  const avgThroughput =
    throughputOutTokens.reduce((acc, d) => acc + d[throughputOutLabel], 0) /
    throughputOutTokens.length;
  const bestThroughput = Math.max(
    ...rollingThroughputOutTokens.map((d) => d[throughputOutLabel])
  );
  const timeAtBestThroughput = rollingThroughputOutTokens.find(
    (d) => d[throughputOutLabel] === bestThroughput
  ).timeFromStart;
  const vusAtMaxThroughput =
    vus[vus.findIndex((r) => r.timeFromStart > timeAtBestThroughput) - 1][
      vusLabel
    ];
  const sortedThroughput = rollingThroughputOutTokens
    .map((d) => d[throughputOutLabel])
    .sort((a, b) => a - b);
  const p10Throughput =
    sortedThroughput[Math.floor(sortedThroughput.length * 0.1)];

  const subtitle = `Total Requests: ${numRequests}, Success Rate: ${(
    successRate * 100
  ).toFixed(2)}%<br><a href="${dataUrl}" target="_blank">View Data</a>`;

  const getPerformanceAtNVUs = (numVUs, priority = defaultPriority) => {
    // We find the time slice during which the number of VUs equals numVUs
    const startTime = vus.find((d) => d[vusLabel] === numVUs)?.timeFromStart;
    if (typeof startTime === "undefined") {
      return null;
    }
    const endTime = vus.find(
      (d, i) => d[vusLabel] !== numVUs && vus[i - 1]?.[vusLabel] === numVUs
    )?.timeFromStart;
    if (!endTime) {
      return null;
    }

    const durationSlice = getBucket(
      duration,
      "timeFromStart",
      startTime,
      endTime
    );
    const throughputSlice = getBucket(
      rollingThroughputOutTokens,
      "timeFromStart",
      startTime,
      endTime
    );

    const avgResponseTime =
      durationSlice.reduce((acc, d) => acc + d[durationLabel], 0) /
      durationSlice.length;
    const avgThroughput =
      throughputSlice.reduce((acc, d) => acc + d[throughputOutLabel], 0) /
      throughputSlice.length;
    const costPerToken = getHourlyPrice(priority) / avgThroughput / 3600;
    const costPerMillionTokens = costPerToken * 1e6;

    const sortedDuration = durationSlice
      .map((d) => d[durationLabel])
      .sort((a, b) => a - b);
    const p90ResponseTime =
      sortedDuration[Math.floor(sortedDuration.length * 0.9)];

    const sortedThroughput = throughputSlice
      .map((d) => d[throughputOutLabel])
      .sort((a, b) => a - b);
    const p10Throughput =
      sortedThroughput[Math.floor(sortedThroughput.length * 0.1)];

    return {
      avgResponseTime,
      p90ResponseTime,
      avgThroughput,
      p10Throughput,
      costPerToken,
      costPerMillionTokens,
    };
  };

  const tenMinutes = 10 * 60 * 1000;

  const plotHeightScale = 1.3;

  /**
   * Plotly layout
   */
  const layout = {
    title: { text: title, subtitle: { text: subtitle }, y: 0.97 },

    plot_bgcolor: plotBackgroundColor,
    font: { family: font, size: 14 },
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

      linecolor: "black",
      linewidth: lineWidth,
    },
    yaxis: {
      title: vusLabel,
      side: "left",
      color: vusColor,
      range: [0, Math.max(...vus.map((d) => d[vusLabel])) * plotHeightScale],
      showgrid: false,
      linewidth: lineWidth,
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
        Math.max(...rollingDuration.map((d) => d[durationLabel])) *
          plotHeightScale,
      ],
      showgrid: false,
      linewidth: lineWidth,
    },
    yaxis3: {
      title: throughputOutLabel,
      side: "right",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: throughputOutColor,
      range: [
        0,
        Math.max(...rollingThroughputOutTokens.map((d) => d[throughputOutLabel])) *
          plotHeightScale,
      ],
      showgrid: false,
      linewidth: lineWidth,
    },
    yaxis4: {
      title: errorsLabel,
      side: "right",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: errorsColor,
      range: [0, 1],
      showgrid: false,
      linewidth: lineWidth,
    },
    yaxis5: {
      title: "Node Count",
      side: "left",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: "purple",
      range: [0, Math.max(...nodeCounts.map((d) => d.value)) * plotHeightScale],
    },
    yaxis6: {
      title: throughputInLabel,
      side: "right",
      anchor: "free",
      autoshift: true,
      overlaying: "y",
      color: throughputInColor,
      range: [
        0,
        Math.max(...rollingThroughputInTokens.map((d) => d[throughputInLabel])) *
          plotHeightScale,
      ],
      showgrid: false,
      linewidth: lineWidth,
    },
  };
  Plotly.newPlot(div, data, layout, { displayLogo: false, responsive: true });

  /**
   * Interactive bits and stats summary
   */
  const populateOtherElements = () => {
    const interactionsDiv = document.querySelector(`#${interactionsDivId}`);

    const configText = document.createElement("p");
    configText.style.fontFamily = font;
    configText.textContent = `Configuration: ${gpu.toUpperCase()} | ${vCPUs} vCPUs | ${memGB} GB Memory`;

    const statsText = document.createElement("ul");
    const statsTextId = `${interactionsDivId}-statsText`;
    statsText.id = statsTextId;
    statsText.style.fontFamily = font;

    const updateStatsText = () => {
      const statsText = document.getElementById(statsTextId);
      statsText.innerHTML = "";

      const currentPriority =
        document.getElementById("prioritySelector")?.value || defaultPriority;

      let worstTimeText = `Worst Response Time: ${worstResponseTime.toFixed(
        2
      )}s`;
      if (worstResponseTime.toFixed(2) === "100.00") {
        worstTimeText += " (Timeout)";
      }

      const summaryText = [
        `Max Running Nodes: ${maxNodes}`,
        `Total Cost of ${maxNodes} Replicas at "${currentPriority}" priority: $${getHourlyPrice(
          currentPriority
        ).toFixed(2)}/hr`,
        `Reliability: ${(successRate * 100).toFixed(3)}% of Requests Succeeded`,
        `Best Response Time: ${bestResponseTime.toFixed(2)}s`,
        worstTimeText,
        `Best Throughput: ${bestThroughput.toFixed(
          2
        )} tok/s at ${vusAtMaxThroughput} VUs`,
      ];
      for (const text of summaryText) {
        const li = document.createElement("li");
        li.textContent = text;
        statsText.appendChild(li);
      }

      const vuBuckets = [minVUs, maxVUs];
      if (vusAtMaxThroughput !== minVUs && vusAtMaxThroughput !== maxVUs) {
        vuBuckets.push(vusAtMaxThroughput);
      }
      vuBuckets.sort((a, b) => a - b);

      for (let numVUs of vuBuckets) {
        const performance = getPerformanceAtNVUs(numVUs, currentPriority);
        const performanceTitle = document.createElement("li");
        performanceTitle.textContent = `Performance at ${numVUs} VUs`;
        if (numVUs === vusAtMaxThroughput) {
          performanceTitle.textContent += " (Best Throughput)";
        }
        const performanceList = document.createElement("ul");
        performanceTitle.appendChild(performanceList);
        statsText.appendChild(performanceTitle);

        const performanceItems = [
          `Average Response Time: ${performance.avgResponseTime.toFixed(2)}s`,
          `90th Percentile Response Time: ${performance.p90ResponseTime.toFixed(
            2
          )}s`,
          `Average Throughput: ${performance.avgThroughput.toFixed(2)} tok/s`,
          `10th Percentile Throughput: ${performance.p10Throughput.toFixed(
            2
          )} tok/s`,
          `Cost per 1M Output Tokens: $${performance.costPerMillionTokens.toFixed(4)}`,
        ];

        for (const text of performanceItems) {
          const li = document.createElement("li");
          li.textContent = text;
          performanceList.appendChild(li);
        }
      }

      const overallPerfTitle = document.createElement("li");
      overallPerfTitle.textContent = `Performance Over Entire Test`;
      const overallPerfList = document.createElement("ul");
      overallPerfTitle.appendChild(overallPerfList);
      statsText.appendChild(overallPerfTitle);
      const overallCostPerToken = getHourlyPrice(currentPriority) / avgThroughput / 3600;
      const overallPerfItems = [
        `Average Response Time: ${avgResponseTime.toFixed(2)}s`,
        `90th Percentile Response Time: ${p90ResponseTime.toFixed(2)}s`,
        `Average Throughput: ${avgThroughput.toFixed(2)} tok/s`,
        `10th Percentile Throughput: ${p10Throughput.toFixed(2)} tok/s`,
        `Cost per 1M Output Tokens: $${(overallCostPerToken * 1e6).toFixed(4)}`,
      ];

      for (const text of overallPerfItems) {
        const li = document.createElement("li");
        li.textContent = text;
        overallPerfList.appendChild(li);
      }
    };

    // Create Priority Selector
    const prioritySelector = document.createElement("select");
    prioritySelector.style.fontFamily = font;
    prioritySelector.style.marginRight = "10px";

    prioritySelector.id = "prioritySelector";
    for (const priority of priorityLevels) {
      const option = document.createElement("option");
      option.value = priority;
      option.text = `${priority} | $${(
        getHourlyPrice(priority) / maxNodes
      ).toFixed(2)}/hr/node`;
      prioritySelector.appendChild(option);
    }

    // Set the default value to the first priority level
    prioritySelector.value = defaultPriority;

    const updateThroughputLine = () => {
      throughputOutTokensLine.text = rollingThroughputOutTokens.map(getThroughputLabel);
      Plotly.update(div, [throughputOutTokensLine], layout);
      updateStatsText();
    };

    // Re-render throughput line on change
    prioritySelector.addEventListener("change", updateThroughputLine);

    // Label it
    const label = document.createElement("label");
    label.htmlFor = "prioritySelector";
    label.textContent = "Select Priority Level: ";
    label.style.fontFamily = font;

    const priceFormat = document.createElement("select");
    priceFormat.style.fontFamily = font;
    priceFormat.style.margin = "10px";
    priceFormat.id = "priceFormat";
    for (const format of ["tokPerDollar", "costPerTok"]) {
      const option = document.createElement("option");
      option.value = format;
      option.text =
        format === "tokPerDollar" ? "Output Tokens Per Dollar" : "Cost Per Output Token";
      priceFormat.appendChild(option);
    }

    priceFormat.value = "tokPerDollar";

    const formatLabel = document.createElement("label");
    formatLabel.htmlFor = "priceFormat";
    formatLabel.textContent = "View";
    formatLabel.style.fontFamily = font;

    priceFormat.addEventListener("change", updateThroughputLine);

    const prioritySpan = document.createElement("span");
    prioritySpan.appendChild(label);
    prioritySpan.appendChild(prioritySelector);

    const formatSpan = document.createElement("span");
    formatSpan.appendChild(formatLabel);
    formatSpan.appendChild(priceFormat);

    interactionsDiv.appendChild(configText);
    interactionsDiv.appendChild(prioritySpan);
    interactionsDiv.appendChild(formatSpan);
    interactionsDiv.appendChild(statsText);

    updateStatsText();
  };
  populateOtherElements();
}

Object.keys(window)
  .filter((key) => key.startsWith("benchmarkViz"))
  .forEach((key) => render(window[key]));
