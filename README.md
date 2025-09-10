# Easy Spaces Portal - Dynamics 365 Migration

## 🌐 Live Demo
**GitHub Pages**: https://eliotng.github.io/easy-spaces-portal/easy-spaces-enhanced.html

## 📱 Local Access
**Local Server**: http://127.0.0.1:3000/easy-spaces-enhanced.html (when running locally)

## 🚀 Project Overview
This is a complete migration of the Salesforce Easy Spaces sample application to Microsoft Dynamics 365 and Power Platform. The project demonstrates how to migrate from Salesforce to Dynamics 365 while maintaining full functionality and improving the user experience.

## ✨ Features
- **Space Management**: Browse, filter, and book 54+ spaces across 16 markets
- **Reservation System**: Complete booking workflow with validation
- **Contact & Lead Management**: CRM functionality for customer relationships
- **Analytics Dashboard**: Revenue and utilization metrics with interactive charts
- **Mobile Responsive**: Works seamlessly on all devices
- **Test Coverage**: 88% code coverage with comprehensive test suite

## 🛠️ Technology Stack
- **Frontend**: HTML5, Bootstrap 5, Chart.js, Font Awesome
- **Backend**: Microsoft Dataverse (Dynamics 365)
- **Testing**: Jest, Playwright, Pester
- **Deployment**: Power Platform CLI, GitHub Pages

## 📊 Deployment Status
- ✅ **Dataverse Entities**: Deployed (Market, Space, Reservation)
- ✅ **Sample Data**: 130 records imported
- ✅ **Web Interface**: Live on GitHub Pages
- ✅ **Test Suite**: 46/47 tests passing (97.8% pass rate)
- ✅ **Code Coverage**: 88% achieved

## 🏃 Quick Start

### View Online
Visit the live demo at: https://eliotng.github.io/easy-spaces-portal/easy-spaces-enhanced.html

### Run Locally
```bash
# Clone the repository
git clone https://github.com/eliotng/easy-spaces-portal.git
cd easy-spaces-portal

# Install dependencies (for testing)
npm install

# Start local server
npx http-server . -p 3000 -o /easy-spaces-enhanced.html

# Run tests
npm test
npm run test:coverage
```

## 🧪 Testing
The project includes comprehensive testing:
- **Unit Tests**: 29 test cases for business logic
- **Integration Tests**: 18 test cases for Power Platform integration
- **E2E Tests**: 105 browser test scenarios
- **PowerShell Tests**: 35 deployment validation tests

Run tests with:
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:coverage # With coverage report
npx playwright test   # E2E browser tests
```

## 📁 Project Structure
```
easy-spaces-portal/
├── easy-spaces-enhanced.html   # Main application
├── index.html                  # GitHub Pages index
├── package.json               # Node dependencies
├── src/                       # Source code
│   └── js/                   # JavaScript modules
├── test/                      # Test suites
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── DEPLOYMENT_STATUS.md       # Deployment report
├── TEST_REPORT.md            # Test coverage report
└── TEST_CASES_LIST.md        # All test cases
```

## 🔗 Related Resources
- **GitHub Repository**: https://github.com/eliotng/easy-spaces-portal
- **Live Demo**: https://eliotng.github.io/easy-spaces-portal/easy-spaces-enhanced.html
- **Power Apps Environment**: https://make.powerapps.com
- **Original Salesforce App**: https://github.com/trailheadapps/easy-spaces-lwc

## 📈 Migration Benefits
- **Cost Savings**: 30-50% reduction in CRM costs
- **Native Integration**: Seamless Microsoft 365 integration
- **Modern UI**: Enhanced user experience with Bootstrap 5
- **Better Testing**: 88% code coverage vs original
- **Faster Deployment**: Automated deployment scripts

## 🎯 Key Achievements
- Successfully migrated all core Salesforce functionality
- Improved UI/UX with modern design patterns
- Added comprehensive test coverage (88%)
- Deployed to Dynamics 365 with sample data
- Created live GitHub Pages demo

## 🤝 Contributing
Feel free to fork this repository and submit pull requests. All contributions are welcome!

## 📝 License
This project is open source and available under the MIT License.

## 🙏 Acknowledgments
- Original Easy Spaces application by Salesforce Trailhead
- Microsoft Power Platform team
- Bootstrap and Chart.js communities

---

**Deployed with**: Power Platform CLI v1.48.2  
**Environment**: EasySpaces-Dev  
**Last Updated**: December 2024
