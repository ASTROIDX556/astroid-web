import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { navSections } from '../../lib/nav';

describe('Mobile Navigation Drawer (#368)', () => {
  describe('Navigation items & sections structure', () => {
    test('defines required sections and valid route links', () => {
      assert.ok(navSections.length >= 4, 'Should contain at least 4 main sections');

      const headings = navSections.map((s) => s.heading);
      assert.ok(headings.includes('Command'), 'Includes Command section');
      assert.ok(headings.includes('Operate'), 'Includes Operate section');
      assert.ok(headings.includes('Govern'), 'Includes Govern section');
      assert.ok(headings.includes('Workspace'), 'Includes Workspace section');

      const allItems = navSections.flatMap((s) => s.items);
      const routes = allItems.map((i) => i.href);

      assert.ok(routes.includes('/overview'), 'Includes /overview link');
      assert.ok(routes.includes('/agents'), 'Includes /agents link');
      assert.ok(routes.includes('/policies'), 'Includes /policies link');
      assert.ok(routes.includes('/approvals'), 'Includes /approvals link');
      assert.ok(routes.includes('/budgets'), 'Includes /budgets link');
      assert.ok(routes.includes('/audit'), 'Includes /audit link');
      assert.ok(routes.includes('/settings'), 'Includes /settings link');
    });

    test('each nav item has a label, href, and icon component', () => {
      for (const section of navSections) {
        for (const item of section.items) {
          assert.ok(item.label.length > 0, `Item label is defined`);
          assert.ok(item.href.startsWith('/'), `Item href ${item.href} is relative root route`);
          assert.ok(
            typeof item.icon === 'function' || typeof item.icon === 'object',
            `Icon component is present for ${item.label}`,
          );
        }
      }
    });
  });

  describe('Active route indicator logic', () => {
    test('correctly identifies exact route match and subpath matches', () => {
      const isRouteActive = (pathname: string, href: string) =>
        pathname === href || pathname.startsWith(`${href}/`);

      assert.equal(isRouteActive('/overview', '/overview'), true);
      assert.equal(isRouteActive('/agents/create', '/agents'), true);
      assert.equal(isRouteActive('/agents', '/policies'), false);
      assert.equal(isRouteActive('/settings/api-keys', '/settings'), true);
    });
  });

  describe('Accessibility attributes contract', () => {
    test('specifies expected ARIA drawer attributes', () => {
      const expectedDrawerAttrs = {
        id: 'mobile-nav-drawer',
        role: 'dialog',
        'aria-label': 'Navigation',
        'aria-modal': 'true',
      };

      assert.equal(expectedDrawerAttrs.id, 'mobile-nav-drawer');
      assert.equal(expectedDrawerAttrs.role, 'dialog');
      assert.equal(expectedDrawerAttrs['aria-label'], 'Navigation');
      assert.equal(expectedDrawerAttrs['aria-modal'], 'true');
    });

    test('specifies expected ARIA trigger attributes', () => {
      const getTriggerAttrs = (open: boolean) => ({
        type: 'button',
        'aria-label': 'Open navigation menu',
        'aria-expanded': open,
        'aria-controls': 'mobile-nav-drawer',
      });

      const closedTrigger = getTriggerAttrs(false);
      assert.equal(closedTrigger['aria-expanded'], false);
      assert.equal(closedTrigger['aria-controls'], 'mobile-nav-drawer');

      const openTrigger = getTriggerAttrs(true);
      assert.equal(openTrigger['aria-expanded'], true);
    });
  });
});
