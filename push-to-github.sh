#!/bin/bash

echo "🚀 Pushing Easy Spaces Portal to GitHub..."
echo "Repository: https://github.com/eliot.ng/easy-spaces-portal"
echo ""

# Push to GitHub
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! Your code is now on GitHub!"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Go to: https://github.com/eliot.ng/easy-spaces-portal/settings/pages"
    echo "2. Under 'Source', select:"
    echo "   - Branch: main"
    echo "   - Folder: / (root)"
    echo "3. Click 'Save'"
    echo ""
    echo "🌐 Your site will be live at:"
    echo "https://eliot.ng.github.io/easy-spaces-portal/"
    echo "(Takes 2-10 minutes to go live)"
else
    echo ""
    echo "⚠️ If you got an authentication error:"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Generate new token (classic)"
    echo "3. Select 'repo' scope"
    echo "4. Use the token as your password"
fi