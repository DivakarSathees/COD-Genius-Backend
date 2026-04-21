import sys

def main():
    data = sys.stdin.read().splitlines()
    if len(data) < 3:
        print("Invalid input")
        return
    try:
        n = int(data[0].strip())
    except:
        print("Invalid input")
        return
    if n < 1 or n > 50:
        print("Invalid input")
        return
    line_prices = data[1].strip()
    tokens = line_prices.split() if line_prices != "" else []
    if len(tokens) != n:
        print("Invalid input")
        return
    prices = []
    try:
        for t in tokens:
            p = int(t)
            if p < 1 or p > 5000:
                print("Invalid input")
                return
            prices.append(p)
    except:
        print("Invalid input")
        return
    try:
        r = int(data[2].strip())
    except:
        print("Invalid input")
        return
    if r < 0 or r > 100:
        print("Invalid input")
        return
    total = sum(prices)
    discount = (total * r) / 100.0
    print("Total discount is {:.2f}".format(discount))

if __name__ == '__main__':
    main()
