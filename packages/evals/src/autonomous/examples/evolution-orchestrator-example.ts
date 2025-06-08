#!/usr/bin/env node

/**
 * Evolution-Enhanced AnalysisOrchestrator Example
 * 
 * This example demonstrates how to use the AnalysisOrchestrator with
 * Darwin Gödel Machine-inspired evolution capabilities integrated.
 */

import { AnalysisOrchestrator } from '../orchestrator/AnalysisOrchestrator.js';
import { createDefaultConstraints, createDefaultSessionConfig } from '../config/claude-config-generator.js';
import { join } from 'path';

async function runEvolutionExample() {
  console.log('🧬 Evolution-Enhanced Analysis Orchestrator Example\n');

  // Create configuration with evolution enabled
  const config = {
    projectRoot: process.cwd(),
    sessionConfig: {
      ...createDefaultSessionConfig('CONTINUOUS_REFINEMENT'),
      maxIterations: 3,
      sessionTimeout: 10 * 60 * 1000 // 10 minutes
    },
    constraints: createDefaultConstraints(),
    dataSource: 'mock' as const,
    reportOutputPath: join(process.cwd(), 'evolution-reports'),
    learningDataPath: join(process.cwd(), 'evolution-learning'),
    enabledFeatures: {
      statisticalAnalysis: true,
      safetyValidation: true,
      learningEngine: true,
      realTimeMonitoring: true,
      automaticReporting: true,
      evolutionEngine: true // Enable evolution!
    },
    evolutionConfig: {
      enableRecommendationEvolution: true,
      enableThresholdLearning: true,
      enablePatternDiscovery: true,
      evolutionInterval: 0, // Manual evolution for demo
      performanceEvaluationWindow: 24
    }
  };

  // Create orchestrator
  const orchestrator = new AnalysisOrchestrator(config);

  // Setup event listeners to show evolution in action
  orchestrator.on('component-initialized', (data) => {
    console.log(`✅ Component initialized: ${data.component}`);
  });

  orchestrator.on('step-started', (data) => {
    if (data.step.includes('evolution')) {
      console.log(`🧬 Evolution step: ${data.step}`);
    }
  });

  orchestrator.on('session-started', (data) => {
    console.log(`🎬 Session started: ${data.sessionId} (${data.mode})`);
  });

  orchestrator.on('iteration-completed', (data) => {
    console.log(`📊 Iteration ${data.iteration}: ${data.result.recommendationsGenerated.length} recommendations`);
    
    // Show evolution-enhanced patterns
    const evolutionPatterns = data.result.patternsFound.filter((p: string) => p.includes('evolution'));
    if (evolutionPatterns.length > 0) {
      console.log(`   🧬 Evolution patterns: ${evolutionPatterns.join(', ')}`);
    }
  });

  try {
    // Initialize orchestrator
    console.log('🚀 Initializing orchestrator with evolution...');
    await orchestrator.initialize();
    console.log('');

    // Start analysis session
    console.log('📊 Starting evolution-enhanced analysis session...');
    const sessionId = await orchestrator.startAnalysisSession();
    
    console.log(`\n🎉 Session completed: ${sessionId}`);

    // Get final metrics including evolution metrics
    const metrics = await orchestrator.getSessionMetrics();
    if (metrics) {
      console.log('\n📈 Final Metrics:');
      console.log(`   Data Processed: ${metrics.totalDataProcessed} records`);
      console.log(`   Patterns Found: ${metrics.analysisPatterns}`);
      console.log(`   Recommendations: ${metrics.recommendationsGenerated} generated`);
      console.log(`   Average Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
      
      if (metrics.evolutionMetrics) {
        console.log('\n🧬 Evolution Metrics:');
        console.log(`   Recommendation Templates: ${metrics.evolutionMetrics.recommendationTemplates.total} total, ${metrics.evolutionMetrics.recommendationTemplates.active} active`);
        console.log(`   Average Template Fitness: ${metrics.evolutionMetrics.recommendationTemplates.averageFitness.toFixed(3)}`);
        console.log(`   Pattern Archive: ${metrics.evolutionMetrics.patterns.total} patterns, avg F1: ${metrics.evolutionMetrics.patterns.averageF1Score.toFixed(3)}`);
        console.log(`   Threshold Improvements: ${metrics.evolutionMetrics.thresholds.improvements.length} optimizations`);
      }
    }

    // Demonstrate evolution configuration export
    console.log('\n🔧 Exporting best evolution configurations...');
    const bestConfigs = orchestrator.exportEvolutionConfigurations();
    if (bestConfigs) {
      console.log(`   Best thresholds: ${Object.keys(bestConfigs.thresholds).length} optimized`);
      console.log(`   Top templates: ${bestConfigs.topTemplates.length} high-performing`);
      console.log(`   Top patterns: ${bestConfigs.topPatterns.length} effective`);
    }

    // Simulate recording recommendation outcomes for learning
    console.log('\n📝 Simulating recommendation outcome recording...');
    if (metrics && metrics.recommendationsGenerated > 0) {
      // Simulate some successful implementations
      for (let i = 0; i < Math.min(3, metrics.recommendationsGenerated); i++) {
        orchestrator.recordRecommendationOutcome(
          `rec-${i}`,
          {
            implemented: true,
            successful: Math.random() > 0.3, // 70% success rate
            userFeedback: 'Automated test feedback'
          }
        );
      }
      console.log('   ✅ Recorded outcomes for evolution learning');
    }

    // Get updated evolution metrics after feedback
    const updatedMetrics = await orchestrator.getEvolutionMetrics();
    if (updatedMetrics) {
      console.log('\n🔄 Updated Evolution Metrics:');
      console.log(`   Template fitness updated based on outcomes`);
    }

    // Cleanup
    await orchestrator.shutdown();
    console.log('\n🏁 Evolution orchestrator shutdown complete');

  } catch (error) {
    console.error('\n❌ Evolution example failed:', error);
    await orchestrator.shutdown();
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvolutionExample().catch(console.error);
}

export { runEvolutionExample }; 