const fs = require('fs');
const path = require('path');

if (process.argv.length !== 3) {
    console.error('Usage: node script.js <directory>');
    process.exit(1);
}

const directory = process.argv[2];
const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.json') 
        && !file.endsWith('-summary.json')
        && !file.endsWith('-test-config.json'));

let htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
</head>
<body>
`;

// Add visualization divs
files.forEach((_, index) => {
    const num = index + 1;
    htmlContent += `<div id="benchmarkViz${num}"></div>\n`;
    htmlContent += `<div id="vizInteractions${num}"></div>\n`;
});

// Start script section
htmlContent += '<script>\n';

// Add visualization configs
files.forEach((file, index) => {
    const num = index + 1;
    const gpuMatch = file.match(/not-streaming-(.+?)\.json/);
    const gpuName = gpuMatch ? gpuMatch[1].replace(/-/g, ' ').toUpperCase() : file;
    
    htmlContent += `
  window.benchmarkViz${num} = {
    dataUrl: "./${file}",
    pricesUrl: "https://raw.githubusercontent.com/SaladTechnologies/salad-recipes/refs/heads/master/benchmark/prices.json",
    title: "${gpuName}",
    divId: "benchmarkViz${num}",
    interactionsDivId: "vizInteractions${num}"
  };`;
});

// Close script section and add visualization script
htmlContent += `
</script>
<script src="/benchmark/embed-result.js" type="module"></script>
</body>
</html>`;

fs.writeFileSync(path.join(directory, 'visualization.html'), htmlContent);
console.log('Generated visualization.html');