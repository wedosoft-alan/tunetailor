# Design Guidelines: Spotify Playlist Generator App

## Design Approach
**Reference-Based Approach**: Drawing inspiration from Spotify's design language and music streaming platforms like Apple Music and YouTube Music. This app requires visual appeal and emotional engagement to create an immersive music discovery experience.

## Core Design Elements

### A. Color Palette
**Dark Mode Primary** (following Spotify's aesthetic):
- Background: 18 8% 8% (deep charcoal)
- Surface: 18 8% 12% (elevated dark gray)
- Primary: 141 76% 48% (Spotify green)
- Text Primary: 0 0% 96%
- Text Secondary: 0 0% 64%

**Light Mode**:
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 141 76% 42%
- Text Primary: 0 0% 12%
- Text Secondary: 0 0% 45%

### B. Typography
- **Primary Font**: Inter (modern, clean readability)
- **Display Font**: Poppins (for headers and branding)
- **Hierarchy**: Bold headers (24px-32px), medium body text (16px), small metadata (14px)

### C. Layout System
**Tailwind Spacing**: Primarily use units 4, 6, 8, 12, 16 for consistent rhythm
- Container max-width: 6xl
- Card padding: p-6 or p-8
- Section gaps: gap-8 or gap-12
- Button padding: px-6 py-3

### D. Component Library
**Navigation**: Minimal top bar with Spotify connect status and user avatar
**Forms**: Large, rounded input fields with subtle borders and focus states
**Cards**: Elevated playlist cards with album artwork, rounded corners (rounded-lg)
**Buttons**: Primary (Spotify green), secondary (outline), and ghost variants
**Player Elements**: Mini preview cards with play/pause controls
**Progress Indicators**: Subtle loading states for playlist generation

### E. Key Sections
1. **Hero Section**: Clean input area with music taste description field and generate button
2. **Connection Status**: Prominent Spotify connection indicator
3. **Generated Playlist Display**: Grid of track cards with artwork and metadata
4. **Playlist Controls**: Save to Spotify, regenerate, and sharing options

## Visual Treatment
- **Gradients**: Subtle radial gradients behind hero section (dark purple to black)
- **Imagery**: Album artwork thumbnails, music-themed background textures
- **Elevation**: Card shadows for depth, following material design principles
- **Rounded Corners**: Consistent border-radius-lg throughout
- **Interactive States**: Hover effects on cards and buttons with smooth transitions

## Images
No large hero image required. Focus on:
- Album artwork thumbnails in playlist displays
- Spotify branding elements
- Music visualization graphics (optional subtle background patterns)
- User avatar in navigation

This design creates a familiar, music-focused experience that feels native to the Spotify ecosystem while maintaining its own identity.