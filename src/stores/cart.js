import { ref, computed, watchEffect } from "vue";
import { defineStore } from "pinia";
import { collection, addDoc, runTransaction, doc } from "firebase/firestore";
import { useFirestore } from "vuefire";
import { useCouponStore } from "./coupons";
import { getCurrentDate } from "@/helpers";

export const useCartStore = defineStore('cart', () => {

    const coupon = useCouponStore()
    const db = useFirestore()
    const items= ref([])
    const subtotal = ref(0)
    const taxes = ref(0)
    const total = ref(0)

    const MAX_PRODUCTS = 5
    const TAX_RATE = .10

    watchEffect(() => {
        subtotal.value = items.value.reduce((total, item) => total + (item.quantity * item.price),0)
        taxes.value = Number ((subtotal.value * TAX_RATE).toFixed(2))
        total.value =Number(((subtotal.value + taxes.value) - coupon.discount).toFixed(2))  
    },{
        deep:true
    })

    function addItem(item){
        const index = isItemInCart(item.id)
        if(index >= 0){ //si es mayor o igual a 0 existe el producto y no lo agrega
            if(isProductAvailable(item, index)){//limita el numero de click con la cantidad disponible 
                alert('haz alcanzado el limite')
                return
            }
            //actualizar cantidad
            items.value[index].quantity++
        }else{
            items.value.push({...item, quantity: 1, id:item.id })
            console.log('items',items)
        }   
    }

    function updateQuantity(id, quantity){
        items.value = items.value.map(item => item.id === id ? {...item, quantity}: item )
    }

    function removeItem(id){
        items.value = items.value.filter(item => item.id !== id)
    }

    async function checkout() {
        try{
            await addDoc(collection(db, 'sales'),{
                items: items.value.map(item => {
                    const {availability, category, ...data} = item
                    return data
                }),
                subtotal: subtotal.value,
                taxes: taxes.value,
                total: total.value,
                date: getCurrentDate()
                
            })

            //sustrae la cantidad disponible
            items.value.forEach(async(item) => {
                const productRef = doc(db, 'products', item.id)
                await runTransaction(db,async(transaction) => {
                    const currentProduct = await transaction.get(productRef)//se toma el dato
                    const availability = currentProduct.data().availability - item.quantity //se lee el dato
                    transaction.update(productRef,{availability})//se actualiza el dato

                })
            })

            $reset()
            coupon.$reset()

        }catch (error){

        }
    }

    function $reset(){
        items.value = []
        subtotal.value = 0
        taxes.value = 0
        total.value = 0
    }

    const isItemInCart = id => items.value.findIndex(item => item.id === id)

    const isProductAvailable = (item, index) => {
        return items.value[index].quantity >= item.availability || items.value[index].quantity >= MAX_PRODUCTS
    }

    const isEmpty = computed(() => items.value.length === 0)

    const checkProductAvailability = computed(() => {
        return (product) => product.availability < MAX_PRODUCTS ? product.availability : MAX_PRODUCTS
    })
    return{
        addItem,
        updateQuantity,
        removeItem,
        isEmpty,
        items,
        subtotal,
        taxes,
        total,
        checkProductAvailability,
        checkout
    }
})