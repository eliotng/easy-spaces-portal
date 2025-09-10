const SpaceManager = require('../../src/js/space-manager');

describe('SpaceManager', () => {
    let spaceManager;
    let mockElements;

    beforeEach(() => {
        spaceManager = new SpaceManager();
        
        // Setup DOM elements
        document.body.innerHTML = `
            <div id="notification" style="display: none;">
                <div class="alert alert-success">
                    <span class="notification-message"></span>
                </div>
            </div>
            
            <div class="tab-pane" id="dashboard" style="display: block;"></div>
            <div class="tab-pane" id="spaces" style="display: none;"></div>
            <div class="tab-pane" id="reservations" style="display: none;"></div>
            <div class="tab-pane" id="analytics" style="display: none;"></div>
            
            <a class="nav-link active" id="dashboard-tab"></a>
            <a class="nav-link" id="spaces-tab"></a>
            <a class="nav-link" id="reservations-tab"></a>
            <a class="nav-link" id="analytics-tab"></a>
            
            <div id="reservationModal">
                <form id="reservationForm">
                    <select id="spaceSelect">
                        <option value="space1">Conference Room A - $500</option>
                        <option value="space2">Event Hall B - $1000</option>
                    </select>
                    <input id="customerName" value="">
                    <input id="customerEmail" value="">
                    <input id="checkIn" type="date">
                    <input id="checkOut" type="date">
                    <input id="guestCount" value="10">
                </form>
            </div>
            
            <input id="locationFilter" value="">
            <input id="typeFilter" value="">
            <input id="capacityFilter" value="">
            <input id="priceFilter" value="">
            
            <div id="resultCount"></div>
            
            <div class="space-item" data-location="San Francisco" data-type="Conference" data-capacity="50" data-price="500">
                <div class="card-title">Conference Room A</div>
                <div class="price">$500</div>
            </div>
            <div class="space-item" data-location="New York" data-type="Event" data-capacity="200" data-price="1000">
                <div class="card-title">Event Hall B</div>
                <div class="price">$1000</div>
            </div>
            
            <canvas id="revenueChart"></canvas>
            <canvas id="utilizationChart"></canvas>
        `;
    });

    describe('Tab Management', () => {
        test('should show and hide tabs correctly', () => {
            spaceManager.showTab('spaces');
            
            expect(document.getElementById('dashboard').style.display).toBe('none');
            expect(document.getElementById('spaces').style.display).toBe('block');
            expect(document.getElementById('spaces-tab').classList.contains('active')).toBe(true);
            expect(document.getElementById('dashboard-tab').classList.contains('active')).toBe(false);
        });

        test('should update currentTab property', () => {
            spaceManager.showTab('reservations');
            expect(spaceManager.currentTab).toBe('reservations');
        });

        test('should initialize charts when showing analytics tab', () => {
            const initChartsSpy = jest.spyOn(spaceManager, 'initializeCharts');
            spaceManager.showTab('analytics');
            expect(initChartsSpy).toHaveBeenCalled();
        });
    });

    describe('Notification Management', () => {
        test('should show notification with correct message and type', () => {
            spaceManager.showNotification('Test message', 'success');
            
            const notification = document.getElementById('notification');
            const alert = notification.querySelector('.alert');
            const message = notification.querySelector('.notification-message');
            
            expect(notification.style.display).toBe('block');
            expect(alert.classList.contains('alert-success')).toBe(true);
            expect(message.textContent).toBe('Test message');
        });

        test('should show danger notification', () => {
            spaceManager.showNotification('Error message', 'danger');
            
            const alert = document.querySelector('.alert');
            expect(alert.classList.contains('alert-danger')).toBe(true);
        });

        test('should hide notification', () => {
            spaceManager.showNotification('Test');
            spaceManager.hideNotification();
            
            const notification = document.getElementById('notification');
            expect(notification.style.display).toBe('none');
        });

        test('should auto-hide notification after 5 seconds', () => {
            jest.useFakeTimers();
            spaceManager.showNotification('Test');
            
            jest.advanceTimersByTime(5000);
            
            const notification = document.getElementById('notification');
            expect(notification.style.display).toBe('none');
            
            jest.useRealTimers();
        });
    });

    describe('Space Management', () => {
        test('should book space with pre-filled values', () => {
            const today = new Date().toISOString().split('T')[0];
            spaceManager.bookSpace('Conference Room A', 500);
            
            const spaceSelect = document.getElementById('spaceSelect');
            const checkIn = document.getElementById('checkIn');
            const checkOut = document.getElementById('checkOut');
            
            expect(spaceSelect.value).toBe('space1');
            expect(checkIn.value).toBe(today);
            expect(checkOut.value).toBe(today);
        });

        test('should filter spaces by location', () => {
            document.getElementById('locationFilter').value = 'San Francisco';
            const count = spaceManager.filterSpaces();
            
            const spaces = document.querySelectorAll('.space-item');
            expect(spaces[0].style.display).toBe('');
            expect(spaces[1].style.display).toBe('none');
            expect(count).toBe(1);
        });

        test('should filter spaces by type', () => {
            document.getElementById('typeFilter').value = 'Event';
            const count = spaceManager.filterSpaces();
            
            const spaces = document.querySelectorAll('.space-item');
            expect(spaces[0].style.display).toBe('none');
            expect(spaces[1].style.display).toBe('');
            expect(count).toBe(1);
        });

        test('should filter spaces by capacity range', () => {
            document.getElementById('capacityFilter').value = '100-300';
            const count = spaceManager.filterSpaces();
            
            const spaces = document.querySelectorAll('.space-item');
            expect(spaces[0].style.display).toBe('none');
            expect(spaces[1].style.display).toBe('');
            expect(count).toBe(1);
        });

        test('should filter spaces by price', () => {
            document.getElementById('priceFilter').value = '750';
            const count = spaceManager.filterSpaces();
            
            const spaces = document.querySelectorAll('.space-item');
            expect(spaces[0].style.display).toBe('');
            expect(spaces[1].style.display).toBe('none');
            expect(count).toBe(1);
        });

        test('should clear all filters', () => {
            document.getElementById('locationFilter').value = 'Test';
            document.getElementById('typeFilter').value = 'Test';
            
            spaceManager.clearFilters();
            
            expect(document.getElementById('locationFilter').value).toBe('');
            expect(document.getElementById('typeFilter').value).toBe('');
        });
    });

    describe('Reservation Management', () => {
        test('should create new reservation', () => {
            const today = new Date().toISOString().split('T')[0];
            spaceManager.createReservation();
            
            expect(document.getElementById('checkIn').value).toBe(today);
            expect(document.getElementById('checkOut').value).toBe(today);
        });

        test('should save reservation with valid data', () => {
            // Create a modal instance first
            const modalElement = document.getElementById('reservationModal');
            new bootstrap.Modal(modalElement);
            
            document.getElementById('customerName').value = 'John Doe';
            document.getElementById('customerEmail').value = 'john@example.com';
            document.getElementById('spaceSelect').value = 'space1';
            
            const reservation = spaceManager.saveReservation();
            
            expect(reservation).toBeTruthy();
            expect(reservation.customerName).toBe('John Doe');
            expect(reservation.customerEmail).toBe('john@example.com');
            expect(reservation.space).toBe('space1');
            expect(spaceManager.reservations.length).toBe(1);
        });

        test('should not save reservation without required fields', () => {
            document.getElementById('customerName').value = '';
            document.getElementById('customerEmail').value = '';
            
            const reservation = spaceManager.saveReservation();
            
            expect(reservation).toBeNull();
            expect(spaceManager.reservations.length).toBe(0);
        });
    });

    describe('Contact Management', () => {
        test('should create new contact', () => {
            const contactData = {
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '555-1234',
                company: 'Acme Corp'
            };
            
            const contact = spaceManager.createContact(contactData);
            
            expect(contact).toBeTruthy();
            expect(contact.name).toBe('Jane Smith');
            expect(contact.email).toBe('jane@example.com');
            expect(contact.id).toMatch(/^CON-/);
            expect(spaceManager.contacts.length).toBe(1);
        });
    });

    describe('Lead Management', () => {
        test('should create new lead', () => {
            const leadData = {
                name: 'Bob Johnson',
                email: 'bob@example.com',
                phone: '555-5678',
                company: 'Tech Inc'
            };
            
            const lead = spaceManager.createLead(leadData);
            
            expect(lead).toBeTruthy();
            expect(lead.name).toBe('Bob Johnson');
            expect(lead.status).toBe('new');
            expect(lead.id).toMatch(/^LEAD-/);
            expect(spaceManager.leads.length).toBe(1);
        });

        test('should qualify lead', () => {
            const lead = spaceManager.createLead({ name: 'Test Lead' });
            const result = spaceManager.qualifyLead(lead.id);
            
            expect(result).toBe(true);
            expect(lead.status).toBe('qualified');
        });

        test('should convert lead to contact', () => {
            const lead = spaceManager.createLead({
                name: 'Convert Test',
                email: 'convert@example.com'
            });
            
            global.confirm = jest.fn(() => true);
            const contact = spaceManager.convertLead(lead.id);
            
            expect(contact).toBeTruthy();
            expect(contact.name).toBe('Convert Test');
            expect(lead.status).toBe('converted');
            expect(lead.convertedToContactId).toBe(contact.id);
            expect(spaceManager.contacts.length).toBe(1);
        });

        test('should not convert lead if user cancels', () => {
            const lead = spaceManager.createLead({ name: 'Cancel Test' });
            
            global.confirm = jest.fn(() => false);
            const contact = spaceManager.convertLead(lead.id);
            
            expect(contact).toBeNull();
            expect(lead.status).toBe('new');
        });
    });

    describe('Analytics', () => {
        test('should initialize revenue chart', () => {
            spaceManager.initializeCharts();
            
            const canvas = document.getElementById('revenueChart');
            expect(canvas.chart).toBeDefined();
            expect(canvas.chart.data.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
        });

        test('should initialize utilization chart', () => {
            spaceManager.initializeCharts();
            
            const canvas = document.getElementById('utilizationChart');
            expect(canvas.chart).toBeDefined();
            expect(canvas.chart.data.labels).toEqual(['Occupied', 'Available', 'Maintenance']);
        });

        test('should export analytics data', () => {
            const data = spaceManager.exportAnalytics();
            
            expect(data).toBeTruthy();
            expect(data.revenue).toBeDefined();
            expect(data.utilization).toBeDefined();
            expect(data.revenue.total).toBe(493000);
            expect(data.utilization.occupied).toBe(65);
        });

        test('should get revenue data', () => {
            const revenue = spaceManager.getRevenueData();
            
            expect(revenue.labels.length).toBe(6);
            expect(revenue.values.length).toBe(6);
            expect(revenue.total).toBe(493000);
        });

        test('should get utilization data', () => {
            const utilization = spaceManager.getUtilizationData();
            
            expect(utilization.occupied).toBe(65);
            expect(utilization.available).toBe(30);
            expect(utilization.maintenance).toBe(5);
        });
    });

    describe('Search Management', () => {
        test('should save search criteria to localStorage', () => {
            document.getElementById('locationFilter').value = 'San Francisco';
            document.getElementById('typeFilter').value = 'Conference';
            document.getElementById('capacityFilter').value = '50-100';
            document.getElementById('priceFilter').value = '1000';
            
            const criteria = spaceManager.saveSearch();
            
            expect(criteria.location).toBe('San Francisco');
            expect(criteria.type).toBe('Conference');
            expect(criteria.capacity).toBe('50-100');
            expect(criteria.price).toBe('1000');
            // localStorage.setItem is called in the saveSearch method
            expect(criteria.savedAt).toBeDefined();
        });

        test('should load saved search criteria', () => {
            const savedCriteria = {
                location: 'New York',
                type: 'Event',
                capacity: '100-200',
                price: '2000'
            };
            
            // Setup filter elements first
            document.getElementById('locationFilter').value = '';
            document.getElementById('typeFilter').value = '';
            document.getElementById('capacityFilter').value = '';
            document.getElementById('priceFilter').value = '';
            
            // Mock global localStorage.getItem to return our saved criteria
            global.localStorage.getItem = jest.fn((key) => {
                if (key === 'savedSearch') {
                    return JSON.stringify(savedCriteria);
                }
                return null;
            });
            
            const loaded = spaceManager.loadSavedSearch();
            
            expect(loaded).toBeTruthy();
            expect(loaded.location).toBe('New York');
            expect(loaded.type).toBe('Event');
            expect(document.getElementById('locationFilter').value).toBe('New York');
            expect(document.getElementById('typeFilter').value).toBe('Event');
        });

        test('should return null if no saved search', () => {
            localStorage.getItem = jest.fn(() => null);
            
            const loaded = spaceManager.loadSavedSearch();
            
            expect(loaded).toBeNull();
        });
    });
});