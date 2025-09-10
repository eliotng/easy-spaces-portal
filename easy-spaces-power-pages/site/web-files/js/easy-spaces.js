// Easy Spaces JavaScript

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Easy Spaces Portal Loaded');
    
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize date pickers
    initializeDatePickers();
    
    // Initialize form validation
    initializeFormValidation();
});

// Date Picker Initialization
function initializeDatePickers() {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        // Set min date to today
        const today = new Date().toISOString().split('T')[0];
        input.setAttribute('min', today);
    });
}

// Form Validation
function initializeFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    
    Array.prototype.slice.call(forms).forEach(function (form) {
        form.addEventListener('submit', function (event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
}

// API Calls
const EasySpacesAPI = {
    getSpaces: async function(marketId) {
        const response = await fetch(/api/spaces?marketId=);
        return await response.json();
    },
    
    getAvailability: async function(spaceId, startDate, endDate) {
        const response = await fetch(/api/availability?spaceId=&start=&end=);
        return await response.json();
    },
    
    createReservation: async function(reservationData) {
        const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(reservationData)
        });
        return await response.json();
    }
};

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Calendar Functions
function generateCalendar(containerId, year, month) {
    const container = document.getElementById(containerId);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let calendar = '<div class="calendar-grid">';
    
    // Add day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
        calendar += <div class="calendar-header"></div>;
    });
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
        calendar += '<div class="calendar-day empty"></div>';
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        calendar += <div class="calendar-day" data-date="--">
                        <div class="day-number"></div>
                        <div class="day-content"></div>
                     </div>;
    }
    
    calendar += '</div>';
    container.innerHTML = calendar;
}

// Filter Functions
function filterSpaces(filters) {
    const spaces = document.querySelectorAll('.space-card');
    
    spaces.forEach(space => {
        let show = true;
        
        if (filters.type && space.dataset.type !== filters.type) {
            show = false;
        }
        
        if (filters.capacity && parseInt(space.dataset.capacity) < parseInt(filters.capacity)) {
            show = false;
        }
        
        if (filters.theme && space.dataset.theme !== filters.theme) {
            show = false;
        }
        
        space.parentElement.style.display = show ? 'block' : 'none';
    });
}

// Export functions for global use
window.EasySpaces = {
    API: EasySpacesAPI,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    generateCalendar: generateCalendar,
    filterSpaces: filterSpaces
};
