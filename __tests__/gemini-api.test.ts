/**
 * @jest-environment node
 */

/**
 * Tests for the /api/analyze-photo route
 *
 * Tests input validation, size limits, error handling, and prompt construction
 * with conversation context.
 *
 * Uses @jest-environment node so that the native Node.js Web API globals
 * (Request, Response, Headers) are available — NextRequest requires them.
 */

// Mock the Google GenAI SDK before importing the route
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

// Import AFTER polyfills and mocks
import { POST } from '../app/api/analyze-photo/route';
import { NextRequest } from 'next/server';

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3003/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/analyze-photo -- input validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key', NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 400 when imageData is missing', async () => {
    const req = createRequest({});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('returns 400 when imageData is empty string', async () => {
    const req = createRequest({ imageData: '' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 413 when image exceeds 10 MB', async () => {
    const largeImageData = 'x'.repeat(10 * 1024 * 1024 + 1);
    const req = createRequest({ imageData: largeImageData });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(413);
    expect(data.success).toBe(false);
    expect(data.error).toContain('too large');
  });

  it('returns 500 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = createRequest({ imageData: 'base64data' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('GEMINI_API_KEY');
  });
});

describe('/api/analyze-photo -- successful analysis', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key', NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns analysis from Gemini on valid request', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'This appears to be a healthy tomato plant with some nitrogen deficiency.',
    });

    const req = createRequest({ imageData: 'base64imagedata' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analysis).toContain('tomato');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('strips data URL prefix from imageData', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Healthy plant.',
    });

    const req = createRequest({ imageData: 'data:image/jpeg;base64,abc123' });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const imagePart = callArgs.contents[0].parts[1];
    expect(imagePart.inlineData.data).toBe('abc123');
  });

  it('includes conversation context in prompt when provided', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Focused analysis based on context.',
    });

    const req = createRequest({
      imageData: 'base64data',
      conversationContext: 'User mentioned yellow leaves on their tomato plant',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const textPart = callArgs.contents[0].parts[0];
    expect(textPart.text).toContain('Conversation so far');
    expect(textPart.text).toContain('yellow leaves');
  });

  it('truncates conversation context to 5000 chars', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Analysis result.',
    });

    const longContext = 'a'.repeat(10000);
    const req = createRequest({
      imageData: 'base64data',
      conversationContext: longContext,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const textPart = callArgs.contents[0].parts[0];
    expect(textPart.text.length).toBeLessThan(10000 + 500);
  });

  it('handles non-string conversationContext gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Analysis without context.',
    });

    const req = createRequest({
      imageData: 'base64data',
      conversationContext: 12345,
    });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const textPart = callArgs.contents[0].parts[0];
    expect(textPart.text).not.toContain('Conversation so far');
  });
});

describe('/api/analyze-photo -- error handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key', NODE_ENV: 'test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 500 when Gemini returns empty analysis', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '' });

    const req = createRequest({ imageData: 'base64data' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('No analysis');
  });

  it('returns 500 when Gemini returns null text', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: null });

    const req = createRequest({ imageData: 'base64data' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('returns 500 when Gemini API throws an error', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const req = createRequest({ imageData: 'base64data' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Photo analysis failed');
  });

  it('returns detailed error in development mode', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    mockGenerateContent.mockRejectedValueOnce(new Error('Specific API error message'));

    const req = createRequest({ imageData: 'base64data' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Specific API error message');
  });

  it('sends image as JPEG to Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Analysis result.',
    });

    const req = createRequest({ imageData: 'base64data' });
    await POST(req);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const imagePart = callArgs.contents[0].parts[1];
    expect(imagePart.inlineData.mimeType).toBe('image/jpeg');
  });

  it('uses gemini-3-flash-preview model', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Analysis.',
    });

    const req = createRequest({ imageData: 'base64data' });
    await POST(req);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-3-flash-preview');
  });
});
