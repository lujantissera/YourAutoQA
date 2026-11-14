import { InMemoryJobRepository } from './in-memory-job-repository.js';
import { describeJobRepositoryContract } from './job-repository.contract.js';

describeJobRepositoryContract('InMemoryJobRepository', (options) => ({
  repository: new InMemoryJobRepository(options),
}));
