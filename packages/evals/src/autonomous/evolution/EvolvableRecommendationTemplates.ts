import { EventEmitter } from 'events';
import { Recommendation } from '../types.js';

export interface RecommendationTemplate {
  id: string;
  template: string;
  placeholders: string[];
  performanceMetrics: {
    timesUsed: number;
    implementationRate: number;
    successRate: number;
    avgConfidenceScore: number;
  };
  parentId?: string;
  generation: number;
  createdAt: Date;
  lastUsed?: Date;
}

export interface TemplateArchive {
  templates: Map<string, RecommendationTemplate>;
  activeTemplates: Set<string>;
  retiredTemplates: Set<string>;
}

export interface EvolutionConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  eliteRatio: number;
  minPerformanceThreshold: number;
  evaluationPeriod: number; // days
}

export class EvolvableRecommendationTemplates extends EventEmitter {
  private archive: TemplateArchive;
  private config: EvolutionConfig;
  private outcomeHistory: Map<string, TemplateOutcome[]>;

  constructor(config: Partial<EvolutionConfig> = {}) {
    super();
    
    this.config = {
      populationSize: 20,
      mutationRate: 0.1,
      crossoverRate: 0.3,
      eliteRatio: 0.2,
      minPerformanceThreshold: 0.3,
      evaluationPeriod: 7,
      ...config
    };

    this.archive = {
      templates: new Map(),
      activeTemplates: new Set(),
      retiredTemplates: new Set()
    };

    this.outcomeHistory = new Map();
    this.initializeBaseTemplates();
  }

  private initializeBaseTemplates(): void {
    // Initialize with proven base templates
    const baseTemplates: Partial<RecommendationTemplate>[] = [
      {
        template: "Optimize {component} to improve {metric} by {expectedImprovement}. This change involves {action} which should {benefit}.",
        placeholders: ['component', 'metric', 'expectedImprovement', 'action', 'benefit']
      },
      {
        template: "Address {issue} in {location} by {solution}. Expected impact: {impact}. Implementation effort: {effort}.",
        placeholders: ['issue', 'location', 'solution', 'impact', 'effort']
      },
      {
        template: "Consider {strategy} for {goal}. Analysis shows {evidence} with confidence {confidence}%. Recommended approach: {approach}.",
        placeholders: ['strategy', 'goal', 'evidence', 'confidence', 'approach']
      }
    ];

    baseTemplates.forEach((template, index) => {
      const id = `template_base_${index}`;
      const fullTemplate: RecommendationTemplate = {
        id,
        ...template as RecommendationTemplate,
        performanceMetrics: {
          timesUsed: 0,
          implementationRate: 0.5,
          successRate: 0.5,
          avgConfidenceScore: 0.7
        },
        generation: 0,
        createdAt: new Date()
      };

      this.archive.templates.set(id, fullTemplate);
      this.archive.activeTemplates.add(id);
    });

    this.emit('templates-initialized', { count: baseTemplates.length });
  }

  async generateRecommendation(
    data: Record<string, any>,
    context?: any
  ): Promise<{ recommendation: Recommendation; templateId: string }> {
    // Select template based on performance and diversity
    const templateId = this.selectTemplate(context);
    const template = this.archive.templates.get(templateId)!;
    
    // Fill template with data
    const filledContent = this.fillTemplate(template, data);
    
    // Create recommendation
    const recommendation: Recommendation = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: data.title || 'System Optimization',
      description: filledContent,
      priority: data.priority || 'medium',
      expectedImpact: data.expectedImpact || 'Moderate improvement',
      effort: data.effort || 'medium',
      confidence: data.confidence || 0.7
    };

    // Track usage
    template.performanceMetrics.timesUsed++;
    template.lastUsed = new Date();

    return { recommendation, templateId };
  }

  recordOutcome(templateId: string, outcome: TemplateOutcome): void {
    if (!this.outcomeHistory.has(templateId)) {
      this.outcomeHistory.set(templateId, []);
    }
    
    this.outcomeHistory.get(templateId)!.push(outcome);
    this.updatePerformanceMetrics(templateId);
    
    this.emit('outcome-recorded', { templateId, outcome });
  }

  async evolveTemplates(): Promise<void> {
    this.emit('evolution-started');

    // Evaluate current population
    const evaluations = this.evaluatePopulation();
    
    // Select parents for next generation
    const parents = this.selectParents(evaluations);
    
    // Generate offspring through crossover and mutation
    const offspring = this.generateOffspring(parents);
    
    // Add to archive and update active set
    offspring.forEach(template => {
      this.archive.templates.set(template.id, template);
      this.archive.activeTemplates.add(template.id);
    });

    // Retire poor performers
    this.retirePoorPerformers(evaluations);

    this.emit('evolution-completed', {
      newTemplates: offspring.length,
      retiredTemplates: this.archive.retiredTemplates.size
    });
  }

  private selectTemplate(context?: any): string {
    const activeTemplates = Array.from(this.archive.activeTemplates)
      .map(id => this.archive.templates.get(id)!)
      .filter(t => t.performanceMetrics.timesUsed > 0);

    if (activeTemplates.length === 0) {
      // Return random active template if none have been used
      const templates = Array.from(this.archive.activeTemplates);
      return templates[Math.floor(Math.random() * templates.length)];
    }

    // Use weighted selection based on performance
    const weights = activeTemplates.map(t => 
      t.performanceMetrics.implementationRate * t.performanceMetrics.successRate
    );
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < activeTemplates.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return activeTemplates[i].id;
      }
    }

    return activeTemplates[activeTemplates.length - 1].id;
  }

  private fillTemplate(template: RecommendationTemplate, data: Record<string, any>): string {
    let filled = template.template;
    
    template.placeholders.forEach(placeholder => {
      const value = data[placeholder] || `[${placeholder}]`;
      filled = filled.replace(`{${placeholder}}`, value);
    });

    return filled;
  }

  private updatePerformanceMetrics(templateId: string): void {
    const template = this.archive.templates.get(templateId);
    if (!template) return;

    const outcomes = this.outcomeHistory.get(templateId) || [];
    if (outcomes.length === 0) return;

    // Calculate metrics from recent outcomes
    const recentOutcomes = outcomes.slice(-50); // Last 50 uses
    
    template.performanceMetrics.implementationRate = 
      recentOutcomes.filter(o => o.implemented).length / recentOutcomes.length;
    
    template.performanceMetrics.successRate = 
      recentOutcomes.filter(o => o.successful).length / recentOutcomes.length;
    
    template.performanceMetrics.avgConfidenceScore = 
      recentOutcomes.reduce((sum, o) => sum + o.confidenceScore, 0) / recentOutcomes.length;
  }

  private evaluatePopulation(): Map<string, number> {
    const evaluations = new Map<string, number>();
    
    this.archive.activeTemplates.forEach(id => {
      const template = this.archive.templates.get(id)!;
      const fitness = this.calculateFitness(template);
      evaluations.set(id, fitness);
    });

    return evaluations;
  }

  private calculateFitness(template: RecommendationTemplate): number {
    const metrics = template.performanceMetrics;
    
    // Weighted fitness function
    const fitness = 
      metrics.implementationRate * 0.4 +
      metrics.successRate * 0.4 +
      metrics.avgConfidenceScore * 0.2;

    // Penalize unused templates
    if (metrics.timesUsed < 5) {
      return fitness * 0.5;
    }

    return fitness;
  }

  private selectParents(evaluations: Map<string, number>): RecommendationTemplate[] {
    const sorted = Array.from(evaluations.entries())
      .sort((a, b) => b[1] - a[1]);

    const eliteCount = Math.floor(this.config.populationSize * this.config.eliteRatio);
    const parents: RecommendationTemplate[] = [];

    // Add elite templates
    for (let i = 0; i < eliteCount && i < sorted.length; i++) {
      const template = this.archive.templates.get(sorted[i][0])!;
      parents.push(template);
    }

    // Tournament selection for remaining slots
    while (parents.length < this.config.populationSize / 2) {
      const tournament = this.tournamentSelection(evaluations);
      parents.push(tournament);
    }

    return parents;
  }

  private tournamentSelection(evaluations: Map<string, number>): RecommendationTemplate {
    const tournamentSize = 3;
    const candidates: string[] = [];
    const activeArray = Array.from(this.archive.activeTemplates);

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * activeArray.length);
      candidates.push(activeArray[randomIndex]);
    }

    const winner = candidates.reduce((best, current) => {
      const bestFitness = evaluations.get(best) || 0;
      const currentFitness = evaluations.get(current) || 0;
      return currentFitness > bestFitness ? current : best;
    });

    return this.archive.templates.get(winner)!;
  }

  private generateOffspring(parents: RecommendationTemplate[]): RecommendationTemplate[] {
    const offspring: RecommendationTemplate[] = [];

    for (let i = 0; i < parents.length - 1; i += 2) {
      if (Math.random() < this.config.crossoverRate) {
        const [child1, child2] = this.crossover(parents[i], parents[i + 1]);
        offspring.push(child1, child2);
      }
    }

    // Apply mutations
    offspring.forEach(child => {
      if (Math.random() < this.config.mutationRate) {
        this.mutate(child);
      }
    });

    return offspring;
  }

  private crossover(
    parent1: RecommendationTemplate,
    parent2: RecommendationTemplate
  ): [RecommendationTemplate, RecommendationTemplate] {
    // Simple template crossover - swap parts of templates
    const parts1 = parent1.template.split('. ');
    const parts2 = parent2.template.split('. ');
    
    const crossoverPoint = Math.floor(Math.random() * Math.min(parts1.length, parts2.length));
    
    const child1Template = [
      ...parts1.slice(0, crossoverPoint),
      ...parts2.slice(crossoverPoint)
    ].join('. ');
    
    const child2Template = [
      ...parts2.slice(0, crossoverPoint),
      ...parts1.slice(crossoverPoint)
    ].join('. ');

    const child1: RecommendationTemplate = {
      id: `template_gen_${Date.now()}_1`,
      template: child1Template,
      placeholders: this.extractPlaceholders(child1Template),
      performanceMetrics: {
        timesUsed: 0,
        implementationRate: 0.5,
        successRate: 0.5,
        avgConfidenceScore: 0.7
      },
      parentId: parent1.id,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      createdAt: new Date()
    };

    const child2: RecommendationTemplate = {
      id: `template_gen_${Date.now()}_2`,
      template: child2Template,
      placeholders: this.extractPlaceholders(child2Template),
      performanceMetrics: {
        timesUsed: 0,
        implementationRate: 0.5,
        successRate: 0.5,
        avgConfidenceScore: 0.7
      },
      parentId: parent2.id,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      createdAt: new Date()
    };

    return [child1, child2];
  }

  private mutate(template: RecommendationTemplate): void {
    const mutations = [
      () => this.addPhrase(template),
      () => this.removePhrase(template),
      () => this.reorderPhrases(template),
      () => this.synonymReplace(template)
    ];

    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    mutation();
    
    // Update placeholders after mutation
    template.placeholders = this.extractPlaceholders(template.template);
  }

  private addPhrase(template: RecommendationTemplate): void {
    const phrases = [
      "This is based on historical patterns.",
      "Similar changes have shown positive results.",
      "Risk assessment indicates low impact.",
      "Performance metrics support this approach."
    ];

    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    template.template += ` ${phrase}`;
  }

  private removePhrase(template: RecommendationTemplate): void {
    const sentences = template.template.split('. ');
    if (sentences.length > 1) {
      sentences.splice(Math.floor(Math.random() * sentences.length), 1);
      template.template = sentences.join('. ');
    }
  }

  private reorderPhrases(template: RecommendationTemplate): void {
    const sentences = template.template.split('. ');
    for (let i = sentences.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sentences[i], sentences[j]] = [sentences[j], sentences[i]];
    }
    template.template = sentences.join('. ');
  }

  private synonymReplace(template: RecommendationTemplate): void {
    const synonyms: Record<string, string[]> = {
      'improve': ['enhance', 'optimize', 'boost', 'strengthen'],
      'change': ['modification', 'adjustment', 'update', 'alteration'],
      'impact': ['effect', 'influence', 'outcome', 'result'],
      'approach': ['method', 'strategy', 'technique', 'solution']
    };

    Object.entries(synonyms).forEach(([word, alternatives]) => {
      if (template.template.includes(word)) {
        const replacement = alternatives[Math.floor(Math.random() * alternatives.length)];
        template.template = template.template.replace(word, replacement);
      }
    });
  }

  private extractPlaceholders(template: string): string[] {
    const matches = template.match(/\{(\w+)\}/g) || [];
    return matches.map(match => match.slice(1, -1));
  }

  private retirePoorPerformers(evaluations: Map<string, number>): void {
    evaluations.forEach((fitness, templateId) => {
      if (fitness < this.config.minPerformanceThreshold) {
        this.archive.activeTemplates.delete(templateId);
        this.archive.retiredTemplates.add(templateId);
        
        this.emit('template-retired', { templateId, fitness });
      }
    });
  }

  getArchiveStats(): {
    totalTemplates: number;
    activeTemplates: number;
    retiredTemplates: number;
    averageFitness: number;
    generationDistribution: Record<number, number>;
  } {
    const activeTemplatesList = Array.from(this.archive.activeTemplates)
      .map(id => this.archive.templates.get(id)!);

    const totalFitness = activeTemplatesList.reduce((sum, template) => 
      sum + this.calculateFitness(template), 0
    );

    const generationDistribution: Record<number, number> = {};
    activeTemplatesList.forEach(template => {
      generationDistribution[template.generation] = 
        (generationDistribution[template.generation] || 0) + 1;
    });

    return {
      totalTemplates: this.archive.templates.size,
      activeTemplates: this.archive.activeTemplates.size,
      retiredTemplates: this.archive.retiredTemplates.size,
      averageFitness: totalFitness / activeTemplatesList.length,
      generationDistribution
    };
  }
}

export interface TemplateOutcome {
  templateId: string;
  recommendationId: string;
  implemented: boolean;
  successful: boolean;
  confidenceScore: number;
  feedback?: string;
  timestamp: Date;
} 