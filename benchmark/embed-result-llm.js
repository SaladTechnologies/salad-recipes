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
  throughputLabel = "Throughput (req/s)",
  throughputColor = "blue",
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

  for (let i = 0; i < results.timeFromStart.length; i++) {
    if (results.metric[i] === "vus") {
      vus.push({
        timeFromStart: results.timeFromStart[i],
        [vusLabel]: results.value[i],
      });
    } else if (results.metric[i] === "http_req_duration") {
      duration.push({
        timeFromStart: results.timeFromStart[i],
        [durationLabel]: results.value[i] / 1000,
      });
    } else if (
      results.metric[i] === "http_req_failed" &&
      results.value[i] > 0
    ) {
      allErrors.push({
        timeFromStart: results.timeFromStart[i],
        value: results.value[i],
      });
    } else if (results.metric[i] === "node_count") {
      nodeCounts.push({
        timeFromStart: results.timeFromStart[i],
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
    throughputPeriod,
    throughputLabel
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
      document.getElementById("priceFormat")?.value || "reqPerDollar";
    const currentPriority =
      document.getElementById("prioritySelector")?.value || defaultPriority;
    const hourlyPrice = getHourlyPrice(currentPriority);
    const reqPerSecond = d[throughputLabel];
    const reqPerHour = reqPerSecond * 3600;
    const costPerRequest = hourlyPrice / reqPerHour;
    let priceText = "";
    if (displayFormat === "reqPerDollar") {
      const reqPerDollar = 1 / costPerRequest;
      priceText = `${reqPerDollar.toFixed(2)} req/$`;
    } else {
      priceText = `$${costPerRequest.toFixed(5)}/req`;
    }

    return `${time} | ${reqPerSecond.toFixed(2)} req/s | ${priceText}`;
  };

  const vusLine = {
    x: vus.map((d) => d.timeFromStart),
    y: vus.map((d) => d[vusLabel]),
    hovertemplate: `%{text} | %{y} VUs`,
    text: vus.map((d) => msToTime(d.timeFromStart)),
    type: "scattergl",
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
    type: "scattergl",
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
    type: "scattergl",
    mode: "lines",
    name: durationLabel,
    line: { color: durationColor, width: lineWidth },
    yaxis: "y2",
  };

  const throughputLine = {
    x: rollingThroughput.map((d) => d.timeFromStart),
    y: rollingThroughput.map((d) => d[throughputLabel]),
    hovertemplate: `%{text}`,
    text: rollingThroughput.map(getThroughputLabel),
    type: "scattergl",
    mode: "lines",
    name: throughputLabel,
    line: { color: throughputColor, width: lineWidth },
    yaxis: "y3",
  };

  const nodeCountLine = {
    x: nodeCounts.map((d) => d.timeFromStart),
    y: nodeCounts.map((d) => d.value),
    hovertemplate: `%{text} | %{y} Nodes`,
    text: nodeCounts.map((d) => msToTime(d.timeFromStart)),
    type: "scattergl",
    mode: "lines",
    name: "Node Count",
    line: { color: "purple", width: lineWidth },
    yaxis: "y5",
  };

  const data = [vusLine, durationLine, throughputLine, errorsLine, nodeCountLine];

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

  const sortedDuration = duration.map((d) => d[durationLabel]).sort((a, b) => a - b);
  const p90ResponseTime = sortedDuration[Math.floor(sortedDuration.length * 0.9)];
  const minVUs = vus[0][vusLabel];
  const maxVUs = Math.max(...vus.map((d) => d[vusLabel]));
  const avgThroughput =
    throughput.reduce((acc, d) => acc + d[throughputLabel], 0) /
    throughput.length;
  const bestThroughput = Math.max(...rollingThroughput.map((d) => d[throughputLabel]));
  const timeAtBestThroughput = rollingThroughput.find(
    (d) => d[throughputLabel] === bestThroughput
  ).timeFromStart;
  const vusAtMaxThroughput =
    vus[vus.findIndex((r) => r.timeFromStart > timeAtBestThroughput) - 1][
      vusLabel
    ];
  const sortedThroughput = rollingThroughput.map((d) => d[throughputLabel]).sort((a, b) => a - b);
  const p10Throughput = sortedThroughput[Math.floor(sortedThroughput.length * 0.1)];



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
      rollingThroughput,
      "timeFromStart",
      startTime,
      endTime
    );

    const avgResponseTime =
      durationSlice.reduce((acc, d) => acc + d[durationLabel], 0) /
      durationSlice.length;
    const avgThroughput =
      throughputSlice.reduce((acc, d) => acc + d[throughputLabel], 0) /
      throughputSlice.length;
    const costPerImage = getHourlyPrice(priority) / avgThroughput / 3600;
    const imagesPerDollar = 1 / costPerImage;

    const sortedDuration = durationSlice.map((d) => d[durationLabel]).sort((a, b) => a - b);
    const p90ResponseTime = sortedDuration[Math.floor(sortedDuration.length * 0.9)];

    const sortedThroughput = throughputSlice.map((d) => d[throughputLabel]).sort((a, b) => a - b);
    const p10Throughput = sortedThroughput[Math.floor(sortedThroughput.length * 0.1)];

    return {
      avgResponseTime,
      p90ResponseTime,
      avgThroughput,
      p10Throughput,
      costPerImage,
      imagesPerDollar,
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
        Math.max(...rollingDuration.map((d) => d[durationLabel])) * plotHeightScale,
      ],
      showgrid: false,
      linewidth: lineWidth,
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
        Math.max(...rollingThroughput.map((d) => d[throughputLabel])) * plotHeightScale,
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
    }
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

      let worstTimeText = `Worst Response Time: ${worstResponseTime.toFixed(2)}s`
      if (worstResponseTime.toFixed(2) === '100.00') {
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
        )} req/s at ${vusAtMaxThroughput} VUs`,
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
          `90th Percentile Response Time: ${performance.p90ResponseTime.toFixed(2)}s`,
          `Average Throughput: ${performance.avgThroughput.toFixed(2)} req/s`,
          `10th Percentile Throughput: ${performance.p10Throughput.toFixed(2)} req/s`,
          `Cost per Image: $${performance.costPerImage.toFixed(5)}`,
          `Images per Dollar: ${performance.imagesPerDollar.toFixed(2)}`,
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
      const overallPerfItems = [
        `Average Response Time: ${avgResponseTime.toFixed(2)}s`,
        `90th Percentile Response Time: ${p90ResponseTime.toFixed(2)}s`,
        `Average Throughput: ${avgThroughput.toFixed(2)} req/s`,
        `10th Percentile Throughput: ${p10Throughput.toFixed(2)} req/s`,
        `Cost per Image: $${(
          getHourlyPrice(currentPriority) /
          avgThroughput /
          3600
        ).toFixed(5)}`,
        `Images per Dollar: ${(
          1 /
          (getHourlyPrice(currentPriority) / avgThroughput / 3600)
        ).toFixed(2)}`,
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
      throughputLine.text = rollingThroughput.map(getThroughputLabel);
      Plotly.update(div, [throughputLine], layout);
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
    for (const format of ["reqPerDollar", "costPerReq"]) {
      const option = document.createElement("option");
      option.value = format;
      option.text =
        format === "reqPerDollar" ? "Requests per Dollar" : "Cost per Request";
      priceFormat.appendChild(option);
    }

    priceFormat.value = "reqPerDollar";

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
