import java.util.Scanner;
import java.util.Locale;

class Coffee {
    String coffeeName;
    double basePrice;

    Coffee(String coffeeName, double basePrice) {
        this.coffeeName = coffeeName;
        this.basePrice = basePrice;
    }

    double calculatePrice() {
        return basePrice;
    }
}

class PremiumCoffee extends Coffee {
    double toppingPrice;

    PremiumCoffee(String coffeeName, double basePrice, double toppingPrice) {
        super(coffeeName, basePrice);
        this.toppingPrice = toppingPrice;
    }

    @Override
    double calculatePrice() {
        return basePrice + toppingPrice;
    }
}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in).useLocale(Locale.US);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        for (int i = 0; i < n; i++) {
            int type = sc.nextInt();
            String name = sc.next();
            double price = sc.nextDouble();
            if (type == 1) {
                Coffee coffee = new Coffee(name, price);
                System.out.printf(Locale.US, "Coffee: %s, Final Price: %.2f\n", coffee.coffeeName, coffee.calculatePrice());
            } else if (type == 2) {
                double topping = sc.nextDouble();
                PremiumCoffee premium = new PremiumCoffee(name, price, topping);
                System.out.printf(Locale.US, "Coffee: %s, Final Price: %.2f\n", premium.coffeeName, premium.calculatePrice());
            }
        }
        sc.close();
    }
}