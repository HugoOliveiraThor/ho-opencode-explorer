import * as assert from 'assert';
import { UpdateService } from '../../update/UpdateService';

suite('UpdateService', () => {
  test('isUpdateAvailable returns false when local is same as remote', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '1.2.3');
    assert.strictEqual(result, false);
  });

  test('isUpdateAvailable returns true when remote is newer', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '2.0.0');
    assert.strictEqual(result, true);
  });

  test('isUpdateAvailable returns false when local is newer', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('2.0.0', '1.2.3');
    assert.strictEqual(result, false);
  });

  test('isUpdateAvailable handles pre-release versions', () => {
    const service = new UpdateService();
    const result = service.isUpdateAvailable('1.2.3', '1.3.0-beta.1');
    assert.strictEqual(result, true);
  });

  test('getLocalVersion reads from package.json-style version string', () => {
    const service = new UpdateService();
    const version = service.parseVersion('v1.2.3');
    assert.strictEqual(version, '1.2.3');
  });

  test('parseVersion strips leading v', () => {
    const service = new UpdateService();
    assert.strictEqual(service.parseVersion('v0.1.0'), '0.1.0');
    assert.strictEqual(service.parseVersion('2.0.0'), '2.0.0');
  });
});
