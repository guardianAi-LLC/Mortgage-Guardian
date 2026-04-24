const Anthropic = require('@anthropic-ai/sdk');
const { createLogger } = require('../utils/logger');
const { REASONING_PROMPT_INSTRUCTIONS, REASONING_FIELDS } = require('../config/structuredReasoningConfig');
const logger = createLogger('claude');

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

class ClaudeService {
  /**
   * Analyze document using Claude AI
   */
  async analyzeDocument({ prompt, model = 'claude-sonnet-4-5-20250514', maxTokens = 4096, temperature = 0.1 }) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const rawContent = response.content[0].text;

      // Enrich parsed response with default reasoning fields using backward-compatible
      // null defaults — same pattern as evidence enrichment. Consumers that don't
      // expect reasoning fields are unaffected; consumers that do will get the fields
      // populated when Claude provides them.
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(rawContent);
      } catch {
        // Content is not JSON — return as-is with reasoning defaults at top level
      }

      const reasoningDefaults = {
        reasoningSteps: REASONING_FIELDS.reasoningSteps,
        confidence: REASONING_FIELDS.confidence,
        confidenceLevel: REASONING_FIELDS.confidenceLevel,
        confidenceExplanation: REASONING_FIELDS.confidenceExplanation
      };

      const enrichedContent = parsedResult
        ? { ...reasoningDefaults, ...parsedResult }
        : rawContent;

      return {
        content: enrichedContent,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        stopReason: response.stop_reason,
        reasoning: reasoningDefaults
      };

    } catch (error) {
      logger.error('Claude API error', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Build specialized prompt for mortgage document analysis
   */
  buildMortgageAnalysisPrompt(documentText, documentType = 'mortgage_statement') {
    const { GENERAL_REASONING_INSTRUCTION, ANOMALY_REASONING_INSTRUCTION } = REASONING_PROMPT_INSTRUCTIONS;

    const reasoningInstructions = `\n\n${GENERAL_REASONING_INSTRUCTION}\n${ANOMALY_REASONING_INSTRUCTION}`;

    const prompts = {
      mortgage_statement: `You are an expert mortgage auditor. Analyze this mortgage statement and identify any errors, discrepancies, or issues.

Document to analyze:
${documentText}

Please provide:
1. **Summary**: Brief overview of the statement
2. **Key Figures**: Principal balance, interest rate, payment amount, escrow balance
3. **Detected Issues**: Any errors, miscalculations, or red flags
4. **Severity**: Rate each issue as High/Medium/Low
5. **Recommendations**: Steps the homeowner should take
${reasoningInstructions}

Format your response as structured JSON with these fields:
{
  "summary": "...",
  "keyFigures": {
    "principalBalance": 0,
    "interestRate": 0,
    "monthlyPayment": 0,
    "escrowBalance": 0
  },
  "issues": [
    {
      "title": "...",
      "description": "...",
      "severity": "High|Medium|Low",
      "category": "...",
      "potentialImpact": 0,
      "reasoningSteps": ["step 1", "step 2"],
      "confidence": 0.0,
      "confidenceLevel": "high|medium|low",
      "confidenceExplanation": "..."
    }
  ],
  "recommendations": ["..."],
  "reasoningSteps": ["..."],
  "confidence": 0.0
}`,

      escrow_statement: `You are an expert in mortgage escrow account auditing. Analyze this escrow statement for errors.

Document to analyze:
${documentText}

Look for:
- Incorrect property tax calculations
- Insurance premium discrepancies
- Escrow shortage/surplus issues
- Missing or duplicate payments
- Interest calculation errors
${reasoningInstructions}

Provide detailed analysis in JSON format including reasoningSteps and confidence for each finding.`,

      payment_history: `You are a mortgage payment history auditor. Analyze this payment history for discrepancies.

Document to analyze:
${documentText}

Check for:
- Missing payments not recorded
- Late fee charges that shouldn't apply
- Incorrect payment allocation (principal vs interest)
- Unexplained balance changes
${reasoningInstructions}

Provide analysis in JSON format including reasoningSteps and confidence for each finding.`,

      default: `You are an expert mortgage document analyst. Analyze this document and identify any issues or important information.

Document to analyze:
${documentText}
${reasoningInstructions}

Provide a comprehensive analysis with any findings, issues, or recommendations. Include reasoningSteps and confidence in your response.`
    };

    return prompts[documentType] || prompts.default;
  }

  /**
   * Test Claude API connection
   */
  async testConnection() {
    try {
      const result = await this.analyzeDocument({
        prompt: 'Say "API connection successful" in 5 words or less.',
        maxTokens: 20
      });

      return {
        success: true,
        message: typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ClaudeService();
