import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOrganizationPath,
  matchesOrganizationPath,
  parseOrganizationNodeId,
  type OrganizationHierarchy,
} from './organizationPath';

const hierarchy: OrganizationHierarchy = {
  bureau: '大臣官房',
  department: null,
  division: '会計課',
  office: undefined,
  section: '予算係',
  group: null,
  team: null,
};

test('createOrganizationPath omits empty hierarchy levels', () => {
  assert.deepEqual(createOrganizationPath(hierarchy), ['大臣官房', '会計課', '予算係']);
});

test('parseOrganizationNodeId keeps top level separate from its hierarchy path', () => {
  assert.deepEqual(parseOrganizationNodeId('総務省→大臣官房→会計課'), {
    topLevel: '総務省',
    path: ['大臣官房', '会計課'],
  });
  assert.equal(parseOrganizationNodeId(''), null);
});

test('matchesOrganizationPath compares normalized hierarchy positions', () => {
  assert.equal(matchesOrganizationPath(hierarchy, ['大臣官房', '会計課']), true);
  assert.equal(matchesOrganizationPath(hierarchy, ['大臣官房', '予算係']), false);
});
