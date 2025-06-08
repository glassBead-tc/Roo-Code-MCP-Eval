/**
 * Example usage of the Darwin Gödel Machine-inspired evolution components
 * This demonstrates how the three components work together to create a self-improving system
 */

import { EvolutionIntegration } from './EvolutionIntegration.js';

async function main() {
  // Initialize the evolution integration with all components enabled
  const evolution = new EvolutionIntegration({
    enableRecommendationEvolution: true,
    enableThresholdLearning: true,
    enablePatternDiscovery: true,
    evolutionInterval: 1, // Evolve every hour for demo (normally would be daily)
    performanceEvaluationWindow: 24 // Evaluate over 24 hours
  });

  // Set up event listeners to track evolution progress
  evolution.on('evolution-started', () => {
    console.log('🧬 Evolution cycle started');
  });

  evolution.on('component-evolved', ({ component }) => {
    console.log(`✅ ${component} evolved successfully`);
  });

  evolution.on('evolution-completed', async ({ duration, metrics }) => {
    console.log(`🎯 Evolution completed in ${duration}ms`);
    console.log('📊 Evolution Metrics:', JSON.stringify(metrics, null, 2));
  });

  // Initialize the system
  await evolution.initialize();

  // Example 1: Generate evolving recommendations
  console.log('\n--- Example 1: Evolving Recommendations ---');
  
  const telemetryData = {
    errorRate: 0.15,
    responseTime: 450,
    throughput: 1000,
    serverLoad: 0.85
  };

  const context = {
    timeOfDay: 'peak',
    dayOfWeek: 'Monday',
    recentChanges: ['deployment_v2.1']
  };

  // Generate a recommendation using evolved templates
  const recommendation = await evolution.generateRecommendation(telemetryData, context);
  console.log('Generated Recommendation:', recommendation);

  // Simulate user feedback on the recommendation
  setTimeout(() => {
    evolution.recordRecommendationOutcome(
      recommendation.id,
      'template_001', // Would be returned by generateRecommendation in real implementation
      {
        implemented: true,
        successful: true,
        userFeedback: 'Reduced error rate by 50%'
      }
    );
    console.log('✅ Recorded positive outcome for recommendation');
  }, 1000);

  // Example 2: Dynamic threshold learning
  console.log('\n--- Example 2: Dynamic Threshold Learning ---');
  
  // Get current threshold
  const errorThreshold = evolution.getThreshold('error_rate_threshold');
  console.log(`Current error rate threshold: ${errorThreshold}`);

  // Simulate detections and outcomes
  const detections = [
    { detected: true, actual: true },   // True positive
    { detected: true, actual: false },  // False positive
    { detected: false, actual: false }, // True negative
    { detected: true, actual: true },   // True positive
    { detected: false, actual: true },  // False negative
  ];

  detections.forEach((detection, i) => {
    evolution.recordThresholdDetection(
      'error_rate_threshold',
      detection.detected,
      detection.actual
    );
    console.log(`Detection ${i + 1}: ${detection.detected ? 'Alert' : 'No alert'}, Actually ${detection.actual ? 'problem' : 'normal'}`);
  });

  // Example 3: Pattern-based anomaly detection
  console.log('\n--- Example 3: Pattern Discovery for Anomaly Detection ---');
  
  // Simulate time series data with anomalies
  const timeSeriesData = [
    100, 102, 98, 101, 99, 103, 97, 250, // Anomaly at index 7
    101, 99, 102, 98, 300, 97, 101, 99   // Anomaly at index 12
  ];

  const detectionResult = await evolution.detectAnomalies(
    timeSeriesData,
    'response_time_monitoring',
    { server: 'api-server-1', endpoint: '/api/users' }
  );

  console.log(`Detected ${detectionResult.anomalies.length} anomalies using pattern: ${detectionResult.patternUsed}`);
  detectionResult.anomalies.forEach(anomaly => {
    console.log(`  - Index ${anomaly.index}: value=${anomaly.value}, confidence=${anomaly.confidence.toFixed(2)}`);
  });

  // Record the outcome to improve pattern selection
  const detectedIndices = detectionResult.anomalies.map(a => a.index);
  const actualAnomalies = [7, 12]; // Ground truth
  
  evolution.recordAnomalyDetectionOutcome(
    detectionResult.patternUsed,
    'response_time_monitoring',
    detectedIndices,
    actualAnomalies
  );

  // Example 4: Manual evolution trigger
  console.log('\n--- Example 4: Triggering Evolution ---');
  
  // Normally evolution happens on schedule, but we can trigger it manually
  setTimeout(async () => {
    console.log('🔄 Manually triggering evolution...');
    await evolution.performEvolution();
    
    // Export best configurations after evolution
    const bestConfigs = evolution.exportBestConfigurations();
    console.log('\n📦 Best Configurations:');
    console.log('Thresholds:', bestConfigs.thresholds);
    
    // Get updated metrics
    const metrics = await evolution.getEvolutionMetrics();
    console.log('\n📈 Evolution Progress:');
    console.log(`- Recommendation templates: ${metrics.recommendationTemplates.active} active, avg fitness: ${metrics.recommendationTemplates.averageFitness.toFixed(2)}`);
    console.log(`- Threshold improvements: ${metrics.thresholds.overallImprovement.toFixed(1)}%`);
    console.log(`- Detection patterns: ${metrics.patterns.active} active, avg F1: ${metrics.patterns.averageF1Score.toFixed(2)}`);
    
  }, 3000);

  // Example 5: Simulating continuous operation
  console.log('\n--- Example 5: Continuous Learning Simulation ---');
  
  // Simulate ongoing system operation with feedback
  let iteration = 0;
  const simulationInterval = setInterval(async () => {
    iteration++;
    console.log(`\n🔄 Simulation iteration ${iteration}`);
    
    // Generate synthetic data
    const syntheticData = {
      errorRate: Math.random() * 0.2,
      responseTime: 200 + Math.random() * 300,
      throughput: 800 + Math.random() * 400,
      serverLoad: 0.3 + Math.random() * 0.6
    };
    
    // Generate and evaluate recommendation
    const rec = await evolution.generateRecommendation(syntheticData);
    
    // Simulate random outcomes
    const outcome = {
      implemented: Math.random() > 0.3,
      successful: Math.random() > 0.4,
      userFeedback: Math.random() > 0.5 ? 'Helpful' : undefined
    };
    
    if (outcome.implemented) {
      evolution.recordRecommendationOutcome(rec.id, 'template_sim', outcome);
      console.log(`  Recommendation ${outcome.successful ? 'succeeded' : 'failed'}`);
    }
    
    // Simulate threshold detections
    const threshold = evolution.getThreshold('performance_degradation_threshold');
    const degradation = (syntheticData.responseTime - 350) / 350;
    const detected = degradation > threshold;
    const actual = degradation > 0.15; // Ground truth
    
    evolution.recordThresholdDetection(
      'performance_degradation_threshold',
      detected,
      actual
    );
    
    if (iteration >= 5) {
      clearInterval(simulationInterval);
      console.log('\n✅ Simulation complete');
      
      // Shutdown the evolution system
      setTimeout(async () => {
        await evolution.shutdown();
        console.log('🛑 Evolution system shutdown');
      }, 1000);
    }
  }, 2000);
}

// Run the example
main().catch(console.error); 