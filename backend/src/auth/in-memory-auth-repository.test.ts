import { describeAuthRepositoryContract } from './auth-repository.contract.js';
import { InMemoryAuthRepository } from './in-memory-auth-repository.js';

describeAuthRepositoryContract('InMemoryAuthRepository', (options) => ({
  repository: new InMemoryAuthRepository(options),
}));
