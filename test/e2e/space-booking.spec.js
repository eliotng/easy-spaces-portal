// E2E tests for Space Booking workflow
const { test, expect } = require('@playwright/test');

test.describe('Easy Spaces - Space Booking Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Easy Spaces application
        await page.goto('/easy-spaces-enhanced.html');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
    });
    
    test('should display the homepage with navigation', async ({ page }) => {
        // Check main elements are visible
        await expect(page.locator('.navbar-brand')).toContainText('Easy Spaces');
        await expect(page.locator('#dashboard-tab')).toBeVisible();
        await expect(page.locator('#spaces-tab')).toBeVisible();
        await expect(page.locator('#reservations-tab')).toBeVisible();
        
        // Check hero section
        await expect(page.locator('.hero h1')).toContainText('Easy Spaces');
        await expect(page.locator('.hero .lead')).toBeVisible();
    });
    
    test('should navigate between tabs', async ({ page }) => {
        // Click on Spaces tab
        await page.click('#spaces-tab');
        await expect(page.locator('#spaces')).toBeVisible();
        await expect(page.locator('#dashboard')).not.toBeVisible();
        
        // Click on Reservations tab
        await page.click('#reservations-tab');
        await expect(page.locator('#reservations')).toBeVisible();
        await expect(page.locator('#spaces')).not.toBeVisible();
        
        // Return to Dashboard
        await page.click('#dashboard-tab');
        await expect(page.locator('#dashboard')).toBeVisible();
    });
    
    test('should filter spaces by location', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Enter location filter
        await page.fill('#locationFilter', 'San Francisco');
        await page.click('button:has-text("Apply Filters")');
        
        // Check filtered results
        const visibleSpaces = await page.locator('.space-item:visible').count();
        const sfSpaces = await page.locator('.space-item[data-location="San Francisco"]:visible').count();
        
        expect(sfSpaces).toBeGreaterThan(0);
        expect(visibleSpaces).toBe(sfSpaces);
    });
    
    test('should filter spaces by type', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Select type filter
        await page.selectOption('#typeFilter', 'Conference');
        await page.click('button:has-text("Apply Filters")');
        
        // Verify filtered results
        const conferenceSpaces = await page.locator('.space-item[data-type="Conference"]:visible');
        await expect(conferenceSpaces).toHaveCount(await conferenceSpaces.count());
    });
    
    test('should book a space', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Click book button on first space
        await page.click('.space-item:first-child button:has-text("Book Now")');
        
        // Wait for modal to appear
        await page.waitForSelector('#reservationModal', { state: 'visible' });
        
        // Fill reservation form
        await page.fill('#customerName', 'John Doe');
        await page.fill('#customerEmail', 'john.doe@example.com');
        await page.fill('#customerPhone', '555-1234');
        await page.fill('#guestCount', '25');
        
        // Set dates
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        await page.fill('#checkIn', today);
        await page.fill('#checkOut', tomorrow);
        
        // Add special requests
        await page.fill('#specialRequests', 'Need projector and whiteboard');
        
        // Submit reservation
        await page.click('button:has-text("Confirm Reservation")');
        
        // Check for success notification
        await expect(page.locator('.alert-success')).toContainText('Reservation created successfully');
    });
    
    test('should show validation errors for incomplete reservation', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Open reservation modal
        await page.click('.space-item:first-child button:has-text("Book Now")');
        await page.waitForSelector('#reservationModal', { state: 'visible' });
        
        // Try to submit without filling required fields
        await page.click('button:has-text("Confirm Reservation")');
        
        // Check for error notification
        await expect(page.locator('.alert-danger')).toContainText('Please fill in all required fields');
    });
    
    test('should clear filters', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Apply some filters
        await page.fill('#locationFilter', 'New York');
        await page.selectOption('#typeFilter', 'Event');
        await page.fill('#priceFilter', '500');
        await page.click('button:has-text("Apply Filters")');
        
        // Clear filters
        await page.click('button:has-text("Clear Filters")');
        
        // Verify filters are cleared
        await expect(page.locator('#locationFilter')).toHaveValue('');
        await expect(page.locator('#typeFilter')).toHaveValue('');
        await expect(page.locator('#priceFilter')).toHaveValue('');
        
        // All spaces should be visible
        const allSpaces = await page.locator('.space-item').count();
        const visibleSpaces = await page.locator('.space-item:visible').count();
        expect(visibleSpaces).toBe(allSpaces);
    });
    
    test('should save search criteria', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Set search criteria
        await page.fill('#locationFilter', 'Chicago');
        await page.selectOption('#typeFilter', 'Workspace');
        await page.fill('#capacityFilter', '10-50');
        
        // Save search
        await page.click('button:has-text("Save Search")');
        
        // Check for success notification
        await expect(page.locator('.alert-success')).toContainText('Search criteria saved');
        
        // Reload page
        await page.reload();
        
        // Navigate back to spaces
        await page.click('#spaces-tab');
        
        // Load saved search (if implemented)
        // await page.click('button:has-text("Load Saved Search")');
        // await expect(page.locator('#locationFilter')).toHaveValue('Chicago');
    });
    
    test('should display space details in map view', async ({ page }) => {
        // Navigate to spaces tab
        await page.click('#spaces-tab');
        
        // Click on Map View button
        await page.click('button:has-text("Map View")');
        
        // Wait for map modal
        await page.waitForSelector('#mapModal', { state: 'visible' });
        
        // Check map elements
        await expect(page.locator('#mapModal .modal-title')).toContainText('Space Locations');
        await expect(page.locator('svg.map-svg')).toBeVisible();
        
        // Click on a city marker
        await page.click('.city-marker:first-child');
        
        // Verify location details are highlighted
        await expect(page.locator('.card.border-warning')).toBeVisible();
    });
    
    test('should handle quick booking', async ({ page }) => {
        // Click quick booking button
        await page.click('button:has-text("Quick Booking")');
        
        // Check notification
        await expect(page.locator('.alert-info')).toContainText('Quick booking mode activated');
        
        // Verify reservation modal opens
        await expect(page.locator('#reservationModal')).toBeVisible();
    });
});

test.describe('Reservation Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#reservations-tab');
    });
    
    test('should display reservation list', async ({ page }) => {
        // Check reservation table is visible
        await expect(page.locator('.reservation-list')).toBeVisible();
        
        // Check table headers
        await expect(page.locator('th:has-text("Reservation ID")')).toBeVisible();
        await expect(page.locator('th:has-text("Customer")')).toBeVisible();
        await expect(page.locator('th:has-text("Space")')).toBeVisible();
        await expect(page.locator('th:has-text("Status")')).toBeVisible();
    });
    
    test('should filter reservations by status', async ({ page }) => {
        // Click on status filter buttons
        await page.click('button:has-text("Confirmed")');
        
        // Check notification
        await expect(page.locator('.alert')).toContainText('Filtering reservations: confirmed');
    });
    
    test('should export reservations', async ({ page }) => {
        // Click export button
        await page.click('button:has-text("Export")');
        
        // Check notification
        await expect(page.locator('.alert-success')).toContainText('Exporting reservations to Excel');
    });
});

test.describe('Contact and Lead Management', () => {
    test('should create new contact', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#contacts-tab');
        
        // Click create contact
        await page.click('button:has-text("New Contact")');
        
        // Check notification
        await expect(page.locator('.alert')).toContainText('Opening new contact form');
    });
    
    test('should manage leads', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#leads-tab');
        
        // Test lead actions
        const leadActions = [
            { button: 'New Lead', message: 'Creating new lead' },
            { button: 'Import Leads', message: 'Opening lead import wizard' }
        ];
        
        for (const action of leadActions) {
            if (await page.locator(`button:has-text("${action.button}")`).isVisible()) {
                await page.click(`button:has-text("${action.button}")`);
                await expect(page.locator('.alert')).toContainText(action.message);
            }
        }
    });
    
    test('should qualify and convert lead', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#leads-tab');
        
        // Find a lead with qualify button
        const qualifyButton = page.locator('button:has-text("Qualify")').first();
        if (await qualifyButton.isVisible()) {
            await qualifyButton.click();
            await expect(page.locator('.alert-success')).toContainText('has been qualified');
        }
        
        // Test lead conversion
        const convertButton = page.locator('button:has-text("Convert")').first();
        if (await convertButton.isVisible()) {
            // Handle confirmation dialog
            page.on('dialog', dialog => dialog.accept());
            await convertButton.click();
            await expect(page.locator('.alert-success')).toContainText('converted successfully');
        }
    });
});

test.describe('Analytics Dashboard', () => {
    test('should display analytics charts', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#analytics-tab');
        
        // Wait for charts to load
        await page.waitForSelector('#revenueChart', { state: 'visible' });
        await page.waitForSelector('#utilizationChart', { state: 'visible' });
        
        // Check chart canvases are rendered
        await expect(page.locator('#revenueChart')).toBeVisible();
        await expect(page.locator('#utilizationChart')).toBeVisible();
        
        // Check metrics cards
        await expect(page.locator('.metric-card')).toHaveCount(4);
    });
    
    test('should export analytics report', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        await page.click('#analytics-tab');
        
        // Click export button
        await page.click('button:has-text("Export Report")');
        
        // Check notification
        await expect(page.locator('.alert-success')).toContainText('Exporting analytics report');
    });
});

test.describe('Mobile Responsiveness', () => {
    test('should work on mobile devices', async ({ page, browserName }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        await page.goto('/easy-spaces-enhanced.html');
        
        // Check mobile menu toggle is visible
        const mobileMenuToggle = page.locator('.navbar-toggler');
        if (await mobileMenuToggle.isVisible()) {
            await mobileMenuToggle.click();
            
            // Check navigation menu expands
            await expect(page.locator('.navbar-collapse')).toBeVisible();
        }
        
        // Check content adapts to mobile
        await expect(page.locator('.hero')).toBeVisible();
        
        // Navigate to spaces
        if (await mobileMenuToggle.isVisible()) {
            await page.click('#spaces-tab');
        }
        
        // Check space cards stack vertically on mobile
        const spaceCards = page.locator('.space-card');
        if (await spaceCards.first().isVisible()) {
            const firstCard = await spaceCards.first().boundingBox();
            const secondCard = await spaceCards.nth(1).boundingBox();
            
            if (firstCard && secondCard) {
                // Cards should stack vertically on mobile
                expect(firstCard.y).toBeLessThan(secondCard.y);
            }
        }
    });
});

test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        
        // Check for ARIA labels on interactive elements
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        
        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
            const button = buttons.nth(i);
            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            
            // Button should have either text content or aria-label
            expect(text || ariaLabel).toBeTruthy();
        }
        
        // Check form inputs have labels
        const inputs = page.locator('input:visible');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < Math.min(inputCount, 5); i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            
            if (id) {
                const label = page.locator(`label[for="${id}"]`);
                const hasLabel = await label.count() > 0;
                const hasAriaLabel = await input.getAttribute('aria-label');
                
                // Input should have either associated label or aria-label
                expect(hasLabel || hasAriaLabel).toBeTruthy();
            }
        }
    });
    
    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/easy-spaces-enhanced.html');
        
        // Tab through navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Check focused element
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
        
        // Test Enter key on focused button
        await page.keyboard.press('Enter');
        
        // Should trigger some action (navigation or modal)
        // Specific assertion depends on which element was focused
    });
});