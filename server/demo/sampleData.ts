export const buildDemoResponse = (city: string, preferences?: any) => {
  return {
    demoMode: true,
    weatherContext: `Warm and sunny in ${city}, perfect for a walking food tour.`,
    cityMeta: {
      fullName: city,
      state: "Demo State",
      country: "Demo Country",
      oneLiner: "A vibrant city known for its eclectic mix of traditional and modern flavors.",
    },
    recommendations: [
      {
        name: `Authentic ${city} Hidden Dumplings`,
        description: `Tucked away in an unmarked alley, this tiny stall has been serving hand-folded dumplings for generations. The perfect blend of savory and spicy.`,
        whyItFits: "Matches your adventurous palate while remaining authentic to local traditions.",
        whereToBuyText: "Find the red lantern behind the old post office.",
        searchQuery: "Hidden Dumplings",
        deliveryServiceName: "Local Walk",
        recipe: "- Flour\n- Minced pork\n- Chives\n- Soy sauce\n- Secret local spice blend",
        weight: "Light",
        calories: "350 kcal",
        price: "$4.00",
        isSecretLocalFavorite: true,
        isVerified: false,
        howToOrderLikeALocal: "Just nod at the chef and hold up the number of fingers for how many portions you want."
      },
      {
        name: `Classic ${city} Noodle Soup`,
        description: `The city's most beloved comfort food. A rich, slow-simmered broth with chewy hand-pulled noodles and fresh scallions.`,
        whyItFits: "A staple dish that everyone visiting must try.",
        whereToBuyText: "Available at most night markets in the central district.",
        searchQuery: "Classic Noodle Soup",
        deliveryServiceName: "UberEats",
        recipe: "- Beef bone broth\n- Hand-pulled wheat noodles\n- Scallions\n- Chili oil",
        weight: "Heavy",
        calories: "650 kcal",
        price: "$8.50",
        isSecretLocalFavorite: false,
        isVerified: false,
        howToOrderLikeALocal: "Ask for 'extra spicy, less noodles' for the authentic street-style balance."
      },
      {
        name: `${city} Signature Sweet Pastry`,
        description: `A crispy, flaky dessert filled with sweet custard and dusted with powdered sugar. Famous across the region.`,
        whyItFits: "A perfect sweet finish that perfectly captures the city's sweeter side.",
        whereToBuyText: "Main street bakeries near the central plaza.",
        searchQuery: "Signature Sweet Pastry",
        deliveryServiceName: "Deliveroo",
        recipe: "- Puff pastry\n- Vanilla custard\n- Powdered sugar",
        weight: "Medium",
        calories: "400 kcal",
        price: "$3.50",
        isSecretLocalFavorite: false,
        isVerified: false,
        howToOrderLikeALocal: "Grab them fresh out of the oven around 10 AM before they sell out."
      }
    ]
  };
};
