/**
 * Pre-process the large PA school districts GeoJSON file
 * This runs at build time to avoid memory issues during runtime
 */
const fs = require('fs');
const path = require('path');
const turfArea = require('@turf/area');
const area = turfArea.default || turfArea;

const inputFile = path.join(__dirname, '../public/PaSchoolDistricts2025_10.geojson');
const outputFile = path.join(__dirname, '../public/PaSchoolDistricts2025_10_processed.json');

function generateTextbookColor(inputString) {
  const hash = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  const atlasColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    '#F1C40F', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
    '#E67E22', '#1ABC9C', '#34495E', '#F39C12', '#D35400',
    '#27AE60', '#2980B9', '#8E44AD', '#16A085', '#F4D03F',
    '#58D68D', '#5DADE2', '#AF7AC5', '#F8D7DA', '#D5DBDB',
  ];

  const hashValue = Math.abs(hash(inputString));
  return atlasColors[hashValue % atlasColors.length];
}

console.log('Reading GeoJSON file...');
const fileContents = fs.readFileSync(inputFile, 'utf8');
const mapData = JSON.parse(fileContents);

console.log(`Processing ${mapData.features.length} features...`);

const labels = [];
const borders = [];

// Process in smaller batches to reduce memory pressure
const BATCH_SIZE = 50;
let processed = 0;

for (let i = 0; i < mapData.features.length; i++) {
  const feature = mapData.features[i];
  
  if (!feature.properties?.SCHOOL_NAM) {
    continue;
  }

  const geometry = feature.geometry;
  if (!geometry || !geometry.coordinates || geometry.coordinates.length === 0) {
    continue;
  }

  const name = feature.properties.SCHOOL_NAM;
  const color = generateTextbookColor(name);
  
  // Calculate area - create minimal feature object
  let featureArea = 0;
  try {
    featureArea = area({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: geometry.coordinates,
      },
      properties: {},
    });
  } catch (e) {
    console.warn(`Failed to calculate area for ${name}:`, e.message);
  }
  
  // Calculate label coords using centroid - fast and memory efficient
  let labelCoords = [0, 0];
  if (geometry.coordinates[0] && geometry.coordinates[0].length > 0) {
    const coords = geometry.coordinates[0];
    const ringLength = coords.length;
    
    // Sample points for very large polygons to avoid memory issues
    const maxSamplePoints = 500;
    const step = ringLength > maxSamplePoints ? Math.ceil(ringLength / maxSamplePoints) : 1;
    
    let sumLng = 0, sumLat = 0, count = 0;
    for (let j = 0; j < ringLength; j += step) {
      const point = coords[j];
      if (point && point.length >= 2) {
        sumLng += point[0];
        sumLat += point[1];
        count++;
      }
    }
    
    if (count > 0) {
      labelCoords = [sumLng / count, sumLat / count];
    }
  }
  
  // Create label feature with minimal properties
  labels.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: labelCoords,
    },
    properties: {
      NAME: name,
      COLOR: color,
      AREA: featureArea,
      SCHOOL_NAM: name,
      SCHOOL_DIS: feature.properties.SCHOOL_DIS || null,
      CTY_NAME: feature.properties.CTY_NAME || null,
      IU_NAME: feature.properties.IU_NAME || null,
      IU_NUM: feature.properties.IU_NUM || null,
      AUN_NUM: feature.properties.AUN_NUM || null,
      AVTS: feature.properties.AVTS || null,
    },
  });
  
  // Create border feature - keep geometry but minimize property copying
  const borderProps = {
    SCHOOL_NAM: feature.properties.SCHOOL_NAM,
    SCHOOL_DIS: feature.properties.SCHOOL_DIS,
    CTY_NAME: feature.properties.CTY_NAME,
    IU_NAME: feature.properties.IU_NAME,
    IU_NUM: feature.properties.IU_NUM,
    AUN_NUM: feature.properties.AUN_NUM,
    AVTS: feature.properties.AVTS,
    COLOR: color,
    NAME: name,
  };
  
  borders.push({
    type: 'Feature',
    geometry: feature.geometry,
    properties: borderProps,
  });
  
  processed++;
  
  // Periodic memory hint
  if (processed % BATCH_SIZE === 0) {
    if (global.gc) {
      global.gc();
    }
    process.stdout.write(`\rProcessed ${processed}/${mapData.features.length}...`);
  }
}
process.stdout.write(`\rProcessed ${processed}/${mapData.features.length} complete\n`);

const outputData = {
  data: {
    labels: {
      type: 'FeatureCollection',
      features: labels,
    },
    borders: {
      type: 'FeatureCollection',
      features: borders,
    },
  },
  places: {
    type: 'FeatureCollection',
    features: [],
  },
};

console.log(`Writing processed file...`);
fs.writeFileSync(outputFile, JSON.stringify(outputData), 'utf8');
console.log(`Done! Processed file saved to ${outputFile}`);
console.log(`Processed ${labels.length} districts`);

