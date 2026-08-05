export const MATCH_THRESHOLD = 0.60;
export const REVIEW_THRESHOLD = 0.50;

export type ModelStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export type FaceExtractionCode =
  | 'OK'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'INVALID_EMBEDDING'
  | 'MODEL_ERROR';

export interface FaceExtractionResult {
  code: FaceExtractionCode;
  embedding?: number[];
  message?: string;
}

export type FaceComparisonStatus =
  | 'MATCHED'
  | 'REVIEW_REQUIRED'
  | 'NOT_MATCHED';

export interface FaceComparisonResult {
  status: FaceComparisonStatus;
  similarity: number;
  processingTimeMs: number;
}

// Singleton Human instance and cached initialization promise
let humanInstance: any = null;
let initPromise: Promise<void> | null = null;

const humanConfig: any = {
  backend: 'webgl',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  async: true,
  warmup: 'none',
  cacheModels: true,
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 5, // Check for MULTIPLE_FACES correctly
    },
    mesh: {
      enabled: true,
    },
    description: {
      enabled: true,
    },
    attention: {
      enabled: false,
    },
    iris: {
      enabled: false,
    },
    emotion: {
      enabled: false,
    },
    antispoof: {
      enabled: false,
    },
    liveness: {
      enabled: false,
    },
    gear: {
      enabled: false,
    },
  },
  body: {
    enabled: false,
  },
  hand: {
    enabled: false,
  },
  object: {
    enabled: false,
  },
  segmentation: {
    enabled: false,
  },
  gesture: {
    enabled: false,
  },
};

/**
 * Initializes the Human model library using dynamic import to prevent bundling at startup.
 */
export function initializeFaceComparison(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const humanModule = await import('@vladmandic/human');
      const HumanConstructor = humanModule.default || (humanModule as any).Human;
      if (!HumanConstructor) {
        throw new Error('Cannot find Human class export.');
      }
      humanInstance = new HumanConstructor(humanConfig);
      
      // Explicitly initialize and load models
      await humanInstance.init();
      await humanInstance.load();
      await humanInstance.warmup();
    } catch (error) {
      initPromise = null;
      humanInstance = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Clean helper to convert a File into a decoded HTMLImageElement.
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc ảnh người nhận xe đã chọn.'));
    };
    
    img.src = url;
  });
}

/**
 * Clean helper to convert an image URL into a decoded HTMLImageElement using CORS.
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      resolve(img);
    };
    
    img.onerror = () => {
      reject(new Error('Không thể đọc ảnh người gửi lúc check-in.'));
    };
    
    img.src = url;
  });
}

/**
 * Extracts a single face's descriptor/embedding.
 */
export async function extractSingleFaceEmbedding(
  imageInput: HTMLImageElement,
  isReference: boolean
): Promise<FaceExtractionResult> {
  if (!humanInstance) {
    return {
      code: 'MODEL_ERROR',
      message: 'Mô hình chưa được khởi tạo.',
    };
  }

  try {
    const result = await humanInstance.detect(imageInput);
    const faces = result.face;

    if (!faces || faces.length === 0) {
      return {
        code: 'NO_FACE',
        message: isReference
          ? 'Không phát hiện khuôn mặt trong ảnh người gửi lúc check-in.'
          : 'Không phát hiện khuôn mặt trong ảnh người nhận xe.',
      };
    }

    if (faces.length > 1) {
      return {
        code: 'MULTIPLE_FACES',
        message: isReference
          ? 'Ảnh người gửi lúc check-in chứa nhiều hơn một khuôn mặt.'
          : 'Ảnh người nhận xe chỉ được chứa một khuôn mặt.',
      };
    }

    const face = faces[0];
    const embedding = face.embedding;

    if (!embedding || embedding.length === 0) {
      return {
        code: 'INVALID_EMBEDDING',
        message: 'Không thể trích xuất đặc trưng khuôn mặt từ ảnh này.',
      };
    }

    // Copy array to avoid leaks
    return {
      code: 'OK',
      embedding: [...embedding],
    };
  } catch (error) {
    console.error('Lỗi khi xử lý ảnh qua Human:', error);
    return {
      code: 'MODEL_ERROR',
      message: 'Không thể thực hiện đối chiếu khuôn mặt. Nhân viên vui lòng kiểm tra thủ công.',
    };
  }
}

/**
 * Compares two descriptors using Human's match.similarity API.
 */
export function compareEmbeddings(
  embedding1: number[],
  embedding2: number[],
  processingTimeMs: number
): FaceComparisonResult {
  if (!humanInstance) {
    throw new Error('Mô hình chưa được khởi tạo.');
  }

  const similarityScore = humanInstance.match.similarity(embedding1, embedding2);

  if (!Number.isFinite(similarityScore) || similarityScore < 0 || similarityScore > 1) {
    throw new Error('Không thể thực hiện đối chiếu khuôn mặt. Nhân viên vui lòng kiểm tra thủ công.');
  }

  let status: FaceComparisonStatus;
  if (similarityScore >= MATCH_THRESHOLD) {
    status = 'MATCHED';
  } else if (similarityScore >= REVIEW_THRESHOLD) {
    status = 'REVIEW_REQUIRED';
  } else {
    status = 'NOT_MATCHED';
  }

  return {
    status,
    similarity: similarityScore,
    processingTimeMs,
  };
}
