// Global test setup for Jest
require('@testing-library/jest-dom');

// Mock browser APIs
global.bootstrap = {
  Modal: class MockModal {
    constructor(element) {
      this.element = element;
      MockModal.instances = MockModal.instances || new Map();
      MockModal.instances.set(element, this);
    }
    show() {
      if (this.element) {
        this.element.style.display = 'block';
      }
    }
    hide() {
      if (this.element) {
        this.element.style.display = 'none';
      }
    }
    static getInstance(element) {
      return MockModal.instances ? MockModal.instances.get(element) : null;
    }
  }
};

// Mock Chart.js
global.Chart = class MockChart {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
    this.data = config.data;
    this.options = config.options;
  }
  update() {}
  destroy() {}
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = { 
  href: '', 
  reload: jest.fn(),
  assign: jest.fn()
};

// Mock window.print
window.print = jest.fn();

// Mock alert and confirm
global.alert = jest.fn();
global.confirm = jest.fn(() => true);

// Setup console mocks
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});