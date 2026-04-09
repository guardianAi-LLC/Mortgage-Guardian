/**
 * Document Pipeline Database Persistence Tests
 *
 * Tests _persistPipeline and _loadPipeline with a mock Supabase client.
 * Separate from integration tests because the module-level supabase variable
 * is captured at require time — we need env vars and mock set up before import.
 */

// Set env vars BEFORE any imports (module reads them at load time)
process.env.SUPABASE_URL = 'https://test-db.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key-db';
process.env.ANTHROPIC_API_KEY = 'test-key';

// Mock Supabase with a functioning client
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockSelectSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
const mockEq = jest.fn().mockReturnValue({ single: mockSelectSingle });
const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
const mockFrom = jest.fn().mockReturnValue({
  upsert: mockUpsert,
  select: mockSelect
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom }))
}));

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({
      content: [{ text: '{}' }],
      model: 'test',
      usage: { input_tokens: 0, output_tokens: 0 },
      stop_reason: 'end_turn'
    })}
  }));
});

jest.mock('../../services/documentEncryptionService', () => ({
  encrypt: jest.fn((u, b) => b),
  decrypt: jest.fn((u, b) => b)
}));

// Now require the module — supabase will be initialized with our mock
const documentPipeline = require('../../services/documentPipelineService');

beforeEach(() => {
  documentPipeline.pipelineState.clear();
  jest.clearAllMocks();
  // Reset default mock behavior
  mockUpsert.mockResolvedValue({ error: null });
  mockSelectSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
  mockEq.mockReturnValue({ single: mockSelectSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ upsert: mockUpsert, select: mockSelect });
});

afterAll(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

describe('_persistPipeline with Supabase', () => {
  it('calls Supabase upsert on initPipeline', async () => {
    documentPipeline.initPipeline('doc-db-1', 'user-db', 'mortgage_statement');

    // Wait for async persist (fire-and-forget)
    await new Promise(r => setTimeout(r, 10));

    expect(mockFrom).toHaveBeenCalledWith('pipeline_state');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc-db-1',
        user_id: 'user-db',
        document_type: 'mortgage_statement',
        status: 'uploaded'
      }),
      { onConflict: 'document_id' }
    );
  });

  it('handles upsert error gracefully (logs warning, does not throw)', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'DB write failed' } });

    const pipeline = documentPipeline.initPipeline('doc-db-err', 'user-db', 'unknown');
    await new Promise(r => setTimeout(r, 10));

    // Pipeline should still be created successfully
    expect(pipeline).toBeDefined();
    expect(pipeline.status).toBe('uploaded');
  });

  it('handles thrown exception in persist gracefully', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('Connection refused'));

    const pipeline = documentPipeline.initPipeline('doc-db-throw', 'user-db', 'unknown');
    await new Promise(r => setTimeout(r, 10));

    expect(pipeline).toBeDefined();
    expect(pipeline.status).toBe('uploaded');
  });
});

describe('_loadPipeline with Supabase', () => {
  it('recovers pipeline state from database when not in memory', async () => {
    const mockRow = {
      document_id: 'doc-db-load',
      user_id: 'user-db',
      document_type: 'monthly_statement',
      file_name: 'test.pdf',
      status: 'review',
      steps: { uploaded: { completedAt: '2024-01-01' } },
      extracted_text: 'Test text content',
      classification_results: { classificationType: 'servicing' },
      analysis_results: { summary: { riskLevel: 'low' } },
      case_id: 'case-123',
      error: null,
      retry_count: 2,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T12:00:00Z'
    };

    mockSelectSingle.mockResolvedValueOnce({ data: mockRow, error: null });

    const status = await documentPipeline.getStatus('doc-db-load');

    expect(status).not.toBeNull();
    expect(status.documentId).toBe('doc-db-load');
    expect(status.status).toBe('review');
    expect(status.hasAnalysis).toBe(true);
    expect(status.hasClassification).toBe(true);
    expect(status.caseId).toBe('case-123');
    expect(status.retryCount).toBe(2);

    // Should now be cached in memory
    expect(documentPipeline.pipelineState.has('doc-db-load')).toBe(true);
    const cached = documentPipeline.pipelineState.get('doc-db-load');
    expect(cached.extractedText).toBe('Test text content');
    expect(cached.fileName).toBe('test.pdf');
  });

  it('returns null when DB returns error or no data', async () => {
    mockSelectSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const status = await documentPipeline.getStatus('doc-not-found');
    expect(status).toBeNull();
  });

  it('returns null and logs warning when DB query throws', async () => {
    mockSelectSingle.mockRejectedValueOnce(new Error('DB connection timeout'));

    const status = await documentPipeline.getStatus('doc-db-timeout');
    expect(status).toBeNull();
  });

  it('handles row with null optional fields', async () => {
    const mockRow = {
      document_id: 'doc-db-nulls',
      user_id: 'user-db',
      document_type: 'unknown',
      file_name: null,
      status: 'uploaded',
      steps: null,
      extracted_text: null,
      classification_results: null,
      analysis_results: null,
      case_id: null,
      error: null,
      retry_count: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    };

    mockSelectSingle.mockResolvedValueOnce({ data: mockRow, error: null });

    const status = await documentPipeline.getStatus('doc-db-nulls');

    expect(status).not.toBeNull();
    expect(status.documentId).toBe('doc-db-nulls');
    expect(status.hasAnalysis).toBe(false);
    expect(status.hasClassification).toBe(false);
    expect(status.retryCount).toBe(0); // null coalesces to 0
  });

  it('prefers in-memory cache over DB lookup', async () => {
    // Put something in memory
    documentPipeline.initPipeline('doc-cached', 'user-1', 'unknown');

    const status = await documentPipeline.getStatus('doc-cached');

    // Should not have queried DB
    expect(mockSelect).not.toHaveBeenCalled();
    expect(status).not.toBeNull();
    expect(status.documentId).toBe('doc-cached');
  });
});

describe('fire-and-forget persist catch handlers', () => {
  it('silently handles _persistPipeline rejection on state transitions', async () => {
    // Make _persistPipeline always reject to exercise .catch(() => {}) handlers
    mockUpsert.mockRejectedValue(new Error('DB unavailable'));

    // initPipeline triggers persist (line 338 catch)
    const pipeline = documentPipeline.initPipeline('doc-catch-1', 'user-1', 'unknown');
    expect(pipeline.status).toBe('uploaded');

    // _advanceState triggers persist (line 757 catch)
    documentPipeline._advanceState(pipeline, 'ocr');
    expect(pipeline.status).toBe('ocr');

    // Wait for all fire-and-forget promises to settle
    await new Promise(r => setTimeout(r, 50));

    // Pipeline should be functional despite all DB failures
    expect(documentPipeline.pipelineState.has('doc-catch-1')).toBe(true);
  });
});
