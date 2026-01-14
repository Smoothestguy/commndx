# 3D Network Map Header - Implementation Guide

## 🎉 Overview

A stunning 3D interactive globe visualization with animated network connections, perfect for header sections. Built with **react-globe.gl** and **Three.js**.

![Demo](https://8080-i7bj12h746cld5z0ihv20-28ccba84.us2.manus.computer/network-map-demo)

## ✨ Features

- **3D Interactive Globe** - Fully rotatable and zoomable Earth visualization
- **Animated Network Connections** - Glowing arc connections between cities with flowing animations
- **USA Focus** - Automatically positions camera to showcase the United States
- **Glowing City Markers** - 20 major US cities with customizable markers
- **Night Theme** - Beautiful night-time Earth texture with starry background
- **Responsive** - Automatically adjusts to container dimensions
- **Customizable** - Easy to modify colors, cities, connections, and styling

## 📦 Installation

The required dependencies have already been installed:

```bash
npm install react-globe.gl three
```

## 🚀 Quick Start

### Basic Usage

```tsx
import NetworkMapHeader from '@/components/NetworkMapHeader';

function MyPage() {
  return (
    <NetworkMapHeader 
      title="Nationwide Network"
      subtitle="Connected Solutions Across America"
      height="600px"
    />
  );
}
```

## 🎨 Customization

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | "Nationwide Network" | Main heading text |
| `subtitle` | string | "Connected Solutions Across America" | Subtitle text |
| `height` | string | "500px" | Height of the component |
| `className` | string | undefined | Additional CSS classes |

### Example: Custom Styling

```tsx
<NetworkMapHeader 
  title="Your Custom Title"
  subtitle="Your Custom Subtitle"
  height="700px"
  className="my-custom-class"
/>
```

## 🗺️ Customizing Cities and Connections

To modify the network nodes and connections, edit `/src/components/NetworkMapHeader.tsx`:

### Adding New Cities

```tsx
const cities: NetworkNode[] = [
  { lat: 40.7128, lng: -74.0060, city: 'New York', size: 0.8 },
  { lat: 34.0522, lng: -118.2437, city: 'Los Angeles', size: 0.8 },
  // Add your cities here
  { lat: YOUR_LAT, lng: YOUR_LNG, city: 'Your City', size: 0.6 },
];
```

### Customizing Colors

The arc colors are defined in the `colors` array:

```tsx
const colors = ['#ff6b35', '#f7931e', '#fdc500', '#00b4d8', '#0077b6'];
```

Change these hex values to match your brand colors!

### Adjusting Network Density

Modify the number of connections per city:

```tsx
// Current: 3-5 connections per city
const numConnections = Math.floor(Math.random() * 3) + 3;

// For denser network: 5-8 connections
const numConnections = Math.floor(Math.random() * 4) + 5;

// For sparser network: 2-3 connections
const numConnections = Math.floor(Math.random() * 2) + 2;
```

## 🎯 Integration Examples

### Example 1: Landing Page Hero

```tsx
import NetworkMapHeader from '@/components/NetworkMapHeader';
import { Button } from '@/components/ui/button';

function LandingPage() {
  return (
    <>
      <NetworkMapHeader 
        title="Welcome to Our Platform"
        subtitle="Connecting businesses nationwide"
        height="100vh"
      />
      <div className="container mx-auto py-12">
        {/* Your content */}
      </div>
    </>
  );
}
```

### Example 2: About Page Section

```tsx
function AboutPage() {
  return (
    <div>
      <NetworkMapHeader 
        title="Our Network"
        subtitle="Serving 20+ major cities"
        height="500px"
      />
      <section className="py-12">
        {/* About content */}
      </section>
    </div>
  );
}
```

### Example 3: Dashboard Header

```tsx
function Dashboard() {
  return (
    <PageLayout
      title="Dashboard"
      description="Your network overview"
    >
      <NetworkMapHeader 
        title="Live Network Status"
        subtitle="Real-time connections"
        height="400px"
        className="mb-8 rounded-lg overflow-hidden"
      />
      {/* Dashboard widgets */}
    </PageLayout>
  );
}
```

## 🎬 Animation Settings

### Globe Animation Speed

Adjust the camera transition duration in the component:

```tsx
globeEl.current.pointOfView({
  lat: 39.8283,
  lng: -98.5795,
  altitude: 1.8
}, 2000); // <- Duration in milliseconds (default: 2000ms)
```

### Arc Animation Speed

Modify the `arcDashAnimateTime` prop:

```tsx
arcDashAnimateTime={3000} // <- Duration in milliseconds (default: 3000ms)
```

## 🎨 Styling Tips

### Change Background Gradient

```tsx
className="bg-gradient-to-b from-blue-950 to-slate-900"
```

### Adjust Text Overlay

Edit the overlay section in the component:

```tsx
<div className="absolute inset-0 flex flex-col items-center justify-center z-10">
  <h1 className="text-6xl font-bold text-white">
    {title}
  </h1>
</div>
```

### Remove Text Overlay

Simply remove or comment out the overlay div to have just the globe.

## 🌍 Globe Textures

The component uses these default textures:

- **Earth**: `//unpkg.com/three-globe/example/img/earth-night.jpg`
- **Background**: `//unpkg.com/three-globe/example/img/night-sky.png`

### Using Custom Textures

```tsx
<Globe
  globeImageUrl="/path/to/your/earth-texture.jpg"
  backgroundImageUrl="/path/to/your/background.png"
  // ... other props
/>
```

## 🔧 Advanced Customization

### Adding Bump Maps (3D Terrain)

```tsx
<Globe
  globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
  bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
  // ... other props
/>
```

### Custom Point Styling

```tsx
pointColor={(d: any) => {
  // Color based on city size
  return d.size > 0.7 ? '#ff0000' : '#ffaa00';
}}
pointRadius={(d: any) => d.size * 0.5} // Adjust size multiplier
```

### Adding Rings/Ripples

```tsx
<Globe
  // ... existing props
  ringsData={[
    { lat: 40.7128, lng: -74.0060, maxR: 5, propagationSpeed: 2, repeatPeriod: 1000 }
  ]}
  ringColor={() => '#ff6b35'}
  ringMaxRadius="maxR"
  ringPropagationSpeed="propagationSpeed"
  ringRepeatPeriod="repeatPeriod"
/>
```

## 📱 Responsive Behavior

The component automatically adjusts to its container size. For mobile optimization:

```tsx
<NetworkMapHeader 
  height="400px" // Smaller height on mobile
  className="md:h-[600px]" // Larger on desktop
/>
```

## 🚀 Performance Tips

1. **Merge Points**: The `pointsMerge={true}` prop combines all city markers into a single mesh for better performance
2. **Reduce Connections**: Fewer connections = better performance
3. **Lower Arc Stroke**: Thinner arcs render faster
4. **Disable Atmosphere**: Remove `atmosphereColor` and `atmosphereAltitude` props if not needed

## 📂 File Structure

```
src/
├── components/
│   ├── NetworkMapHeader.tsx     # Main component
│   └── NetworkGlobe.tsx         # Alternative standalone globe
├── pages/
│   └── NetworkMapDemo.tsx       # Demo page
```

## 🔗 Demo & Testing

- **Demo Page**: `/network-map-demo`
- **Live URL**: https://8080-i7bj12h746cld5z0ihv20-28ccba84.us2.manus.computer/network-map-demo

## 📚 Resources

- [react-globe.gl Documentation](https://github.com/vasturiano/react-globe.gl)
- [Globe.GL Examples](https://globe.gl/)
- [Three.js Documentation](https://threejs.org/docs/)

## 🐛 Troubleshooting

### Globe Not Showing

1. Check that dependencies are installed: `npm install react-globe.gl three`
2. Verify the container has a defined height
3. Check browser console for WebGL errors

### Performance Issues

1. Reduce the number of cities and connections
2. Lower the `globeCurvatureResolution` value
3. Disable atmosphere effects
4. Use `pointsMerge={true}`

### Camera Not Positioning Correctly

Adjust the `pointOfView` parameters:

```tsx
globeEl.current.pointOfView({
  lat: 39.8283,    // Latitude
  lng: -98.5795,   // Longitude
  altitude: 1.8    // Distance from globe (1 = surface, 2 = far)
}, 2000);
```

## 🎉 You're All Set!

The 3D Network Map is ready to use on your lovable.dev site. Customize it to match your brand and enjoy the stunning visualization!

For questions or issues, refer to the [react-globe.gl GitHub repository](https://github.com/vasturiano/react-globe.gl/issues).
