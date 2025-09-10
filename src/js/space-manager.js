// Space Management Module - Extracted from easy-spaces-enhanced.html for testing

class SpaceManager {
    constructor() {
        this.spaces = [];
        this.reservations = [];
        this.contacts = [];
        this.leads = [];
        this.currentTab = 'dashboard';
    }

    // Tab Management
    showTab(tabName) {
        // Hide all tabs
        const tabs = document.querySelectorAll('.tab-pane');
        tabs.forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });
        
        // Remove active class from all nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(tabName);
        if (selectedTab) {
            selectedTab.style.display = 'block';
            selectedTab.classList.add('active');
            
            // Update nav link
            const tabLink = document.getElementById(tabName + '-tab');
            if (tabLink) {
                tabLink.classList.add('active');
            }
        }
        
        this.currentTab = tabName;
        
        // Initialize charts if analytics tab
        if (tabName === 'analytics') {
            this.initializeCharts();
        }
    }

    // Notification Management
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        const alert = notification.querySelector('.alert');
        if (!alert) return;
        
        // Update alert class
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        
        // Update message
        const messageElement = alert.querySelector('.notification-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        // Show notification
        notification.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
        
        return true;
    }

    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    // Space Management
    bookSpace(spaceName, price) {
        // Open reservation modal with pre-filled space
        const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
        
        // Pre-select the space
        const spaceSelect = document.getElementById('spaceSelect');
        if (spaceSelect) {
            const options = Array.from(spaceSelect.options);
            const targetOption = options.find(opt => opt.text.includes(spaceName));
            if (targetOption) {
                spaceSelect.value = targetOption.value;
            }
        }
        
        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        if (checkIn) checkIn.value = today;
        if (checkOut) checkOut.value = today;
        
        modal.show();
        return true;
    }

    filterSpaces() {
        const location = (document.getElementById('locationFilter')?.value || '').toLowerCase();
        const type = (document.getElementById('typeFilter')?.value || '').toLowerCase();
        const capacity = document.getElementById('capacityFilter')?.value;
        const price = document.getElementById('priceFilter')?.value;
        
        const spaces = document.querySelectorAll('.space-item');
        let visibleCount = 0;
        
        spaces.forEach(space => {
            const spaceLocation = (space.dataset.location || '').toLowerCase();
            const spaceType = (space.dataset.type || '').toLowerCase();
            const spaceCapacity = parseInt(space.dataset.capacity || 0);
            const spacePrice = parseInt(space.dataset.price || 0);
            
            let show = true;
            
            if (location && !spaceLocation.includes(location)) {
                show = false;
            }
            if (type && !spaceType.includes(type)) {
                show = false;
            }
            if (capacity) {
                const [min, max] = capacity.split('-').map(Number);
                if (max) {
                    if (spaceCapacity < min || spaceCapacity > max) show = false;
                } else {
                    if (spaceCapacity < min) show = false;
                }
            }
            if (price) {
                const maxPrice = parseInt(price);
                if (spacePrice > maxPrice) show = false;
            }
            
            space.style.display = show ? '' : 'none';
            if (show) visibleCount++;
        });
        
        // Update result count
        const resultCount = document.getElementById('resultCount');
        if (resultCount) {
            resultCount.textContent = `${visibleCount} spaces found`;
        }
        
        return visibleCount;
    }

    clearFilters() {
        const filters = ['locationFilter', 'typeFilter', 'capacityFilter', 'priceFilter'];
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) element.value = '';
        });
        this.filterSpaces();
    }

    // Reservation Management
    createReservation() {
        const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
        const form = document.getElementById('reservationForm');
        if (form) form.reset();
        
        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        if (checkIn) checkIn.value = today;
        if (checkOut) checkOut.value = today;
        
        modal.show();
    }

    saveReservation() {
        const name = document.getElementById('customerName')?.value;
        const email = document.getElementById('customerEmail')?.value;
        
        if (name && email) {
            const reservation = {
                id: 'RES-' + Date.now(),
                customerName: name,
                customerEmail: email,
                space: document.getElementById('spaceSelect')?.value,
                checkIn: document.getElementById('checkIn')?.value,
                checkOut: document.getElementById('checkOut')?.value,
                guests: document.getElementById('guestCount')?.value,
                status: 'confirmed',
                createdAt: new Date().toISOString()
            };
            
            this.reservations.push(reservation);
            this.showNotification('Reservation created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('reservationModal'));
            if (modal) modal.hide();
            
            return reservation;
        }
        
        this.showNotification('Please fill in all required fields', 'danger');
        return null;
    }

    // Contact Management
    createContact(contactData) {
        const contact = {
            id: 'CON-' + Date.now(),
            ...contactData,
            createdAt: new Date().toISOString()
        };
        this.contacts.push(contact);
        this.showNotification('Contact created successfully!', 'success');
        return contact;
    }

    // Lead Management
    createLead(leadData) {
        const lead = {
            id: 'LEAD-' + Date.now(),
            ...leadData,
            status: 'new',
            createdAt: new Date().toISOString()
        };
        this.leads.push(lead);
        this.showNotification('Lead created successfully!', 'success');
        return lead;
    }

    qualifyLead(leadId) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
            lead.status = 'qualified';
            this.showNotification(`Lead ${lead.name || leadId} has been qualified!`, 'success');
            return true;
        }
        return false;
    }

    convertLead(leadId) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead && confirm(`Convert ${lead.name || leadId} to a contact?`)) {
            // Create contact from lead
            const contact = this.createContact({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                company: lead.company
            });
            
            // Mark lead as converted
            lead.status = 'converted';
            lead.convertedToContactId = contact.id;
            
            this.showNotification(`Lead ${lead.name || leadId} converted successfully!`, 'success');
            return contact;
        }
        return null;
    }

    // Analytics
    initializeCharts() {
        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx && !revenueCtx.chart) {
            revenueCtx.chart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Revenue',
                        data: [65000, 72000, 68000, 81000, 95000, 112000],
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Utilization Chart
        const utilizationCtx = document.getElementById('utilizationChart');
        if (utilizationCtx && !utilizationCtx.chart) {
            utilizationCtx.chart = new Chart(utilizationCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Occupied', 'Available', 'Maintenance'],
                    datasets: [{
                        data: [65, 30, 5],
                        backgroundColor: [
                            'rgba(102, 126, 234, 0.8)',
                            'rgba(56, 239, 125, 0.8)',
                            'rgba(243, 92, 67, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed + '%';
                                }
                            }
                        }
                    }
                }
            });
        }
        
        return true;
    }

    // Export functions for analytics
    exportAnalytics() {
        const data = {
            revenue: this.getRevenueData(),
            utilization: this.getUtilizationData(),
            reservations: this.reservations,
            exportedAt: new Date().toISOString()
        };
        
        this.showNotification('Exporting analytics report...', 'success');
        return data;
    }

    getRevenueData() {
        return {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            values: [65000, 72000, 68000, 81000, 95000, 112000],
            total: 493000
        };
    }

    getUtilizationData() {
        return {
            occupied: 65,
            available: 30,
            maintenance: 5
        };
    }

    // Utility functions
    saveSearch() {
        const searchCriteria = {
            location: document.getElementById('locationFilter')?.value,
            type: document.getElementById('typeFilter')?.value,
            capacity: document.getElementById('capacityFilter')?.value,
            price: document.getElementById('priceFilter')?.value,
            savedAt: new Date().toISOString()
        };
        
        const storage = (typeof window !== 'undefined' ? window : global).localStorage;
        storage.setItem('savedSearch', JSON.stringify(searchCriteria));
        this.showNotification('Search criteria saved!', 'success');
        return searchCriteria;
    }

    loadSavedSearch() {
        try {
            const saved = (typeof window !== 'undefined' ? window : global).localStorage.getItem('savedSearch');
            if (saved) {
                const criteria = JSON.parse(saved);
                const locationFilter = document.getElementById('locationFilter');
                const typeFilter = document.getElementById('typeFilter');
                const capacityFilter = document.getElementById('capacityFilter');
                const priceFilter = document.getElementById('priceFilter');
                
                if (locationFilter && criteria.location) locationFilter.value = criteria.location;
                if (typeFilter && criteria.type) typeFilter.value = criteria.type;
                if (capacityFilter && criteria.capacity) capacityFilter.value = criteria.capacity;
                if (priceFilter && criteria.price) priceFilter.value = criteria.price;
                
                this.filterSpaces();
                return criteria;
            }
        } catch (e) {
            // Handle errors in test environment
        }
        return null;
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpaceManager;
}